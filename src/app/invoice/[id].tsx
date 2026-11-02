import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Badge, BlueHeader, Button, Card, ChoiceList, DetailRow, ErrorText, Loading, LogoMark, Segmented, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, formatMoney, parseDayMonthYear, parseMoney, parseQuantity, toDayMonthYear, todayIso } from '@/lib/format';
import { INVOICE_STATUS_LABELS, LINE_KIND_LABELS } from '@/lib/labels';
import { supabase, type Tables, type Views } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type LineKind = 'training_fee' | 'livery' | 'sale' | 'commission' | 'transport' | 'extra' | 'deposit' | 'other';

export default function InvoiceScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, reload } = useScreenData(async () => {
    const [invoice, lines, totals, payments, credits] = await Promise.all([
      supabase.from('invoices').select('*, owners(id, name)').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order').order('created_at'),
      supabase.from('invoice_totals').select('*').eq('invoice_id', id).single(),
      supabase.from('payments').select('id, paid_on, amount, method, reference').eq('invoice_id', id).order('paid_on', { ascending: false }),
      supabase.from('credit_notes').select('id, credit_number, issued_on, amount, reason').eq('invoice_id', id).order('issued_on', { ascending: false }),
    ]);
    const inv = must(invoice);
    const ownerHorseIds = must(
      await supabase.from('horses').select('id').eq('business_id', bid).eq('current_owner_id', inv.owner_id),
    ).map((h) => h.id);
    const unbilled = ownerHorseIds.length
      ? must(
          await supabase
            .from('cost_entries')
            .select('id, cost_on, description, amount, horse_id, horses(name), cost_categories(name)')
            .in('horse_id', ownerHorseIds)
            .eq('billable', true)
            .order('cost_on', { ascending: false }),
        )
      : [];
    const linked = must(await supabase.from('invoice_lines').select('cost_entry_id').eq('invoice_id', id).not('cost_entry_id', 'is', null));
    const linkedIds = new Set(linked.map((l) => l.cost_entry_id));

    return {
      invoice: inv,
      lines: must(lines) ?? [],
      totals: must(totals),
      payments: must(payments) ?? [],
      credits: must(credits) ?? [],
      unbilled: unbilled.filter((c) => !linkedIds.has(c.id)),
    };
  }, [id, bid]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Invoice" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can view invoices." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Invoice" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This invoice could not be found.'} />
        </View>
      </View>
    );
  }

  return <InvoiceView data={data} insetsBottom={insets.bottom} reload={reload} />;
}

type Line = Tables<'invoice_lines'>;

function InvoiceView({
  data,
  insetsBottom,
  reload,
}: {
  data: {
    invoice: Tables<'invoices'> & { owners: { id: string; name: string } | null };
    lines: Line[];
    totals: Views<'invoice_totals'> | null;
    payments: { id: string; paid_on: string; amount: number; method: string; reference: string | null }[];
    credits: { id: string; credit_number: string | null; issued_on: string; amount: number; reason: string }[];
    unbilled: { id: string; cost_on: string; description: string | null; amount: number; horse_id: string; horses: { name: string } | null; cost_categories: { name: string } | null }[];
  };
  insetsBottom: number;
  reload: () => Promise<void>;
}) {
  const { business, logoUrl } = useBusiness();
  const currency = business!.currency_code;
  const { invoice, lines, totals, payments, credits, unbilled } = data;
  const isDraft = invoice.status === 'draft';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);

  const issue = async () => {
    if (!confirmIssue) return setConfirmIssue(true);
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id);
    setBusy(false);
    setConfirmIssue(false);
    if (e) return setError(e.message);
    await reload();
  };

  const removeLine = async (lineId: string) => {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.from('invoice_lines').delete().eq('id', lineId);
    if (e) setError(e.message);
    await reload();
    setBusy(false);
  };

  const addSuggested = async (cost: { id: string; cost_on: string; description: string | null; amount: number; horse_id: string; horses: { name: string } | null }) => {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.from('invoice_lines').insert({
      business_id: invoice.business_id,
      invoice_id: invoice.id,
      line_kind: 'extra',
      description: `${cost.description ?? 'Cost'} (${cost.horses?.name ?? 'horse'})`,
      quantity: 1,
      unit_price: cost.amount,
      horse_id: cost.horse_id,
      cost_entry_id: cost.id,
    });
    if (e) setError(e.message);
    await reload();
    setBusy(false);
  };

  const share = () => {
    const lineText = lines.map((l) => `${l.description} — ${formatMoney(l.quantity * l.unit_price, currency)}`).join('\n');
    const message = `${business!.name}\nInvoice ${invoice.invoice_number ?? '(draft)'}\nTo: ${invoice.owners?.name}\n\n${lineText}\n\nTotal: ${formatMoney(totals?.total ?? 0, currency)}\nBalance due: ${formatMoney(totals?.balance ?? 0, currency)}${invoice.due_on ? `\nDue: ${formatDate(invoice.due_on)}` : ''}`;
    Share.share({ message }).catch(() => {});
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={invoice.invoice_number ?? 'Draft invoice'} subtitle={invoice.owners?.name ?? undefined} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <View style={styles.letterhead}>
            <LogoMark name={business!.name} uri={logoUrl} size={44} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{business!.name}</AppText>
              <AppText variant="small">To {invoice.owners?.name ?? '—'}</AppText>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Badge label={INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status} tone={invoice.status === 'paid' ? 'blue' : invoice.status === 'part_paid' ? 'gold' : 'muted'} />
            {invoice.due_on ? <AppText variant="small">Due {formatDate(invoice.due_on)}</AppText> : null}
          </View>
          <DetailRow label="Subtotal" value={formatMoney(totals?.subtotal ?? 0, currency)} />
          <DetailRow label="Tax" value={formatMoney(totals?.tax ?? 0, currency)} />
          <DetailRow label="Total" value={formatMoney(totals?.total ?? 0, currency)} />
          {Number(totals?.paid ?? 0) > 0 ? <DetailRow label="Paid" value={formatMoney(totals?.paid ?? 0, currency)} /> : null}
          {Number(totals?.credited ?? 0) > 0 ? <DetailRow label="Credited" value={formatMoney(totals?.credited ?? 0, currency)} /> : null}
          <DetailRow label="Balance due" value={formatMoney(totals?.balance ?? 0, currency)} last />
          <ErrorText message={error} />
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button kind={isDraft ? 'secondary' : 'gold'} icon="upload" title="Share" onPress={share} disabled={lines.length === 0} />
            </View>
            {isDraft ? (
              <View style={{ flex: 1 }}>
                <Button title={confirmIssue ? 'Tap again to issue' : 'Issue invoice'} onPress={issue} loading={busy} disabled={lines.length === 0} />
              </View>
            ) : null}
          </View>
        </Card>

        <Card>
          <AppText variant="heading">Lines</AppText>
          {lines.length === 0 ? <AppText muted>No lines yet. Add one below.</AppText> : null}
          {lines.map((l, i) => (
            <View key={l.id} style={[styles.lineRow, i < lines.length - 1 && styles.divider]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong" numberOfLines={2}>{l.description}</AppText>
                <AppText variant="small">
                  {LINE_KIND_LABELS[l.line_kind] ?? l.line_kind} · {l.quantity} × {formatMoney(l.unit_price, currency)}
                  {l.tax_applies ? ` · +${l.tax_rate}% tax` : ' · no tax'}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{formatMoney(l.quantity * l.unit_price, currency)}</AppText>
              {isDraft ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Remove line" onPress={() => removeLine(l.id)} disabled={busy} hitSlop={8} style={{ marginLeft: Spacing.sm }}>
                  <AppText variant="small" color={Colors.danger}>Remove</AppText>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>

        {isDraft && unbilled.length > 0 ? (
          <Card>
            <AppText variant="heading">Costs charged to this owner</AppText>
            <AppText variant="small">Logged against their horses and marked to invoice. Tap to add.</AppText>
            {unbilled.map((c, i) => (
              <Pressable key={c.id} onPress={() => addSuggested(c)} disabled={busy} style={[styles.lineRow, i < unbilled.length - 1 && styles.divider]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText numberOfLines={1}>{c.description ?? c.cost_categories?.name ?? 'Cost'} — {c.horses?.name}</AppText>
                  <AppText variant="small">{formatDate(c.cost_on)}</AppText>
                </View>
                <AppText variant="bodyStrong" color={Colors.royalBlue}>{formatMoney(c.amount, currency)}</AppText>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {isDraft ? <AddLineCard invoiceId={invoice.id} businessId={invoice.business_id} onAdded={reload} /> : null}

        {!isDraft ? (
          <>
            <PaymentCard invoiceId={invoice.id} businessId={invoice.business_id} payments={payments} currency={currency} onAdded={reload} />
            <CreditNoteCard invoiceId={invoice.id} businessId={invoice.business_id} credits={credits} currency={currency} onAdded={reload} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddLineCard({ invoiceId, businessId, onAdded }: { invoiceId: string; businessId: string; onAdded: () => Promise<void> }) {
  const [kind, setKind] = useState<LineKind>('other');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [taxApplies, setTaxApplies] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindOptions: LineKind[] = ['training_fee', 'livery', 'transport', 'extra', 'deposit', 'other'];

  const add = async () => {
    setError(null);
    if (!description.trim()) return setError('Describe this line.');
    const qty = parseQuantity(quantity);
    if (qty === null || qty <= 0) return setError('Enter a quantity, for example 1.');
    const unit = parseMoney(price);
    if (unit === null) return setError('Enter the price, for example 2500.');
    setBusy(true);
    const { error: e } = await supabase.from('invoice_lines').insert({
      business_id: businessId,
      invoice_id: invoiceId,
      line_kind: kind,
      description: description.trim(),
      quantity: qty,
      unit_price: unit,
      tax_applies: taxApplies,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setDescription('');
    setQuantity('1');
    setPrice('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a line</AppText>
      <Segmented label="Kind" options={kindOptions.map((k) => ({ value: k, label: LINE_KIND_LABELS[k] }))} value={kind} onChange={setKind} />
      <TextField label="Description" value={description} onChangeText={setDescription} placeholder="October livery" />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Unit price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="2500" />
        </View>
      </View>
      <ToggleRow label="Tax applies" value={taxApplies} onChange={setTaxApplies} last />
      <ErrorText message={error} />
      <Button icon="add" title="Add line" onPress={add} loading={busy} />
    </Card>
  );
}

function PaymentCard({
  invoiceId,
  businessId,
  payments,
  currency,
  onAdded,
}: {
  invoiceId: string;
  businessId: string;
  payments: { id: string; paid_on: string; amount: number; method: string; reference: string | null }[];
  currency: string;
  onAdded: () => Promise<void>;
}) {
  const [date, setDate] = useState(toDayMonthYear(todayIso()));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'eft' | 'cash' | 'card' | 'other'>('eft');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const day = parseDayMonthYear(date);
    if (!day) return setError('Enter the date as day/month/year.');
    const money = parseMoney(amount);
    if (money === null || money <= 0) return setError('Enter the amount paid, for example 2500.');
    setBusy(true);
    const { error: e } = await supabase.from('payments').insert({
      business_id: businessId,
      invoice_id: invoiceId,
      paid_on: day,
      amount: money,
      method,
      reference: reference.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setAmount('');
    setReference('');
    await onAdded();
  };

  return (
    <Card>
      <AppText variant="heading">Payments</AppText>
      {payments.length === 0 ? <AppText muted>No payments recorded yet.</AppText> : null}
      {payments.map((p, i) => (
        <DetailRow key={p.id} label={`${formatDate(p.paid_on)} · ${p.method.toUpperCase()}`} value={formatMoney(p.amount, currency)} last={i === payments.length - 1} />
      ))}
      <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <TextField label={`Amount (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <ChoiceList
        label="Method"
        options={[
          { value: 'eft', label: 'EFT' },
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
          { value: 'other', label: 'Other' },
        ]}
        value={method}
        onChange={setMethod}
      />
      <TextField label="Reference (optional)" value={reference} onChangeText={setReference} />
      <ErrorText message={error} />
      <Button icon="add" title="Record payment" onPress={add} loading={busy} disabled={!amount.trim()} />
    </Card>
  );
}

function CreditNoteCard({
  invoiceId,
  businessId,
  credits,
  currency,
  onAdded,
}: {
  invoiceId: string;
  businessId: string;
  credits: { id: string; credit_number: string | null; issued_on: string; amount: number; reason: string }[];
  currency: string;
  onAdded: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const money = parseMoney(amount);
    if (money === null || money <= 0) return setError('Enter the credit amount.');
    if (!reason.trim()) return setError('Enter a reason for the credit note.');
    setBusy(true);
    const { error: e } = await supabase.from('credit_notes').insert({ business_id: businessId, invoice_id: invoiceId, amount: money, reason: reason.trim() });
    setBusy(false);
    if (e) return setError(e.message);
    setAmount('');
    setReason('');
    await onAdded();
  };

  return (
    <Card>
      <AppText variant="heading">Credit notes</AppText>
      {credits.length === 0 ? <AppText muted>None yet.</AppText> : null}
      {credits.map((c, i) => (
        <DetailRow key={c.id} label={`${c.credit_number ?? ''} · ${formatDate(c.issued_on)}`} value={formatMoney(c.amount, currency)} last={i === credits.length - 1} />
      ))}
      <TextField label={`Amount (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="Overcharged for feed" />
      <ErrorText message={error} />
      <Button icon="add" title="Add credit note" onPress={add} loading={busy} disabled={!amount.trim() || !reason.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  letterhead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
});
