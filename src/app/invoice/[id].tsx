import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Badge, BlueHeader, Button, Card, ChoiceList, DetailRow, ErrorText, Loading, LogoMark, Segmented, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, formatMoney, parseDayMonthYear, parseMoney, parseQuantity, toDayMonthYear, todayIso, dateOrderWords } from '@/lib/format';
import { INVOICE_STATUS_LABELS, LINE_KIND_LABELS } from '@/lib/labels';
import { COPIED_NOTICE, SHARE_FAILED, shareText } from '@/lib/share';
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
      supabase.from('invoices').select('*, owners(id, name, address, tax_number)').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order').order('created_at'),
      supabase.from('invoice_totals').select('*').eq('invoice_id', id).single(),
      supabase.from('payments').select('id, paid_on, amount, method, reference').eq('invoice_id', id).order('paid_on', { ascending: false }),
      supabase.from('credit_notes').select('id, credit_number, issued_on, amount, reason').eq('invoice_id', id).order('issued_on', { ascending: false }),
    ]);
    const inv = must(invoice);
    // Every horse of this owner, including ones that have since left: they can still be billed.
    const ownerHorses = must(
      await supabase.from('horses').select('id, name').eq('business_id', bid).eq('current_owner_id', inv.owner_id).order('name'),
    );
    const ownerHorseIds = ownerHorses.map((h) => h.id);
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
      ownerHorses,
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
    invoice: Tables<'invoices'> & { owners: { id: string; name: string; address: string | null; tax_number: string | null } | null };
    lines: Line[];
    totals: Views<'invoice_totals'> | null;
    payments: { id: string; paid_on: string; amount: number; method: string; reference: string | null }[];
    credits: { id: string; credit_number: string | null; issued_on: string; amount: number; reason: string }[];
    unbilled: { id: string; cost_on: string; description: string | null; amount: number; horse_id: string; horses: { name: string } | null; cost_categories: { name: string } | null }[];
    ownerHorses: { id: string; name: string }[];
  };
  insetsBottom: number;
  reload: () => Promise<void>;
}) {
  const { business, logoUrl } = useBusiness();
  const currency = business!.currency_code;
  const { invoice, lines, totals, payments, credits, unbilled, ownerHorses } = data;
  const isDraft = invoice.status === 'draft';
  const biz = business!;
  const client = invoice.owners;
  const horseNames = new Map(ownerHorses.map((h) => [h.id, h.name]));
  const taxLabel = biz.tax_name || 'Tax';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

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

  const share = async () => {
    setError(null);
    setShareNotice(null);
    const money = (n: number | null | undefined) => formatMoney(n ?? 0, currency);
    const from = [
      biz.name,
      biz.address,
      biz.tax_number ? `${taxLabel} number: ${biz.tax_number}` : null,
      biz.registration_number ? `Registration number: ${biz.registration_number}` : null,
      [biz.phone, biz.email].filter(Boolean).join(' · ') || null,
    ].filter(Boolean);
    const to = [
      `To: ${client?.name ?? ''}`,
      client?.address,
      client?.tax_number ? `${taxLabel} number: ${client.tax_number}` : null,
    ].filter(Boolean);
    const head = [
      `Invoice ${invoice.invoice_number ?? '(draft)'}`,
      invoice.issued_on ? `Date: ${formatDate(invoice.issued_on)}` : null,
      invoice.due_on ? `Due: ${formatDate(invoice.due_on)}` : null,
    ].filter(Boolean);
    const lineText = lines.map((l) => `${l.description} — ${money(l.quantity * l.unit_price)}`);
    const sums = [
      `Subtotal: ${money(totals?.subtotal)}`,
      `${taxLabel}: ${money(totals?.tax)}`,
      `Total: ${money(totals?.total)}`,
      Number(totals?.paid ?? 0) > 0 ? `Paid: ${money(totals?.paid)}` : null,
      Number(totals?.credited ?? 0) > 0 ? `Credited: ${money(totals?.credited)}` : null,
      `Balance due: ${money(totals?.balance)}`,
    ].filter(Boolean);
    const pay = biz.bank_details ? ['How to pay:', biz.bank_details] : [];
    const message = [from, head, to, lineText, sums, pay]
      .filter((block) => block.length > 0)
      .map((block) => block.join('\n'))
      .join('\n\n');

    const outcome = await shareText(message);
    if (outcome === 'copied') setShareNotice(COPIED_NOTICE);
    if (outcome === 'failed') setError(SHARE_FAILED);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={invoice.invoice_number ?? 'Draft invoice'} subtitle={invoice.owners?.name ?? undefined} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <View style={styles.letterhead}>
            <LogoMark name={business!.name} uri={logoUrl} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{biz.name}</AppText>
              {biz.address ? <AppText variant="small">{biz.address}</AppText> : null}
              {biz.tax_number ? (
                <AppText variant="small">
                  {taxLabel} number: {biz.tax_number}
                </AppText>
              ) : null}
              {biz.registration_number ? <AppText variant="small">Registration number: {biz.registration_number}</AppText> : null}
            </View>
          </View>
          <View style={styles.party}>
            <AppText variant="label">Invoice to</AppText>
            <AppText variant="bodyStrong">{client?.name ?? '—'}</AppText>
            {client?.address ? <AppText variant="small">{client.address}</AppText> : null}
            {client?.tax_number ? (
              <AppText variant="small">
                {taxLabel} number: {client.tax_number}
              </AppText>
            ) : null}
          </View>
          <View style={styles.statusRow}>
            <Badge label={INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status} tone={invoice.status === 'paid' ? 'blue' : invoice.status === 'part_paid' ? 'gold' : 'muted'} />
            <AppText variant="small">
              {[invoice.issued_on ? `Issued ${formatDate(invoice.issued_on)}` : null, invoice.due_on ? `Due ${formatDate(invoice.due_on)}` : null]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          <DetailRow label="Subtotal" value={formatMoney(totals?.subtotal ?? 0, currency)} />
          <DetailRow label={taxLabel} value={formatMoney(totals?.tax ?? 0, currency)} />
          <DetailRow label="Total" value={formatMoney(totals?.total ?? 0, currency)} />
          {Number(totals?.paid ?? 0) > 0 ? <DetailRow label="Paid" value={formatMoney(totals?.paid ?? 0, currency)} /> : null}
          {Number(totals?.credited ?? 0) > 0 ? <DetailRow label="Credited" value={formatMoney(totals?.credited ?? 0, currency)} /> : null}
          <DetailRow label="Balance due" value={formatMoney(totals?.balance ?? 0, currency)} last />
          {biz.bank_details ? (
            <View style={styles.party}>
              <AppText variant="label">How to pay</AppText>
              <AppText variant="small">{biz.bank_details}</AppText>
            </View>
          ) : null}
          <ErrorText message={error} />
          {shareNotice ? (
            <AppText variant="small" color={Colors.success} accessibilityLiveRegion="polite">
              {shareNotice}
            </AppText>
          ) : null}
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
                  {LINE_KIND_LABELS[l.line_kind] ?? l.line_kind}
                  {l.horse_id && horseNames.has(l.horse_id) ? ` · ${horseNames.get(l.horse_id)}` : ''} · {l.quantity} × {formatMoney(l.unit_price, currency)}
                  {l.tax_applies ? ` · +${l.tax_rate}% ${taxLabel}` : ` · no ${taxLabel}`}
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

        {isDraft ? (
          <AddLineCard invoiceId={invoice.id} businessId={invoice.business_id} horses={ownerHorses} taxLabel={taxLabel} onAdded={reload} />
        ) : null}

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

/** Stands for "this line is not for one particular horse" in the horse picker. */
const NO_HORSE = '__none__';

function AddLineCard({
  invoiceId,
  businessId,
  horses,
  taxLabel,
  onAdded,
}: {
  invoiceId: string;
  businessId: string;
  horses: { id: string; name: string }[];
  taxLabel: string;
  onAdded: () => Promise<void>;
}) {
  const [kind, setKind] = useState<LineKind>('other');
  // The horse a line is for decides whose income it counts as. With one horse
  // it is chosen already; with several the Manager must pick.
  const [horseId, setHorseId] = useState<string | null>(horses.length === 1 ? horses[0].id : horses.length === 0 ? NO_HORSE : null);
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
    if (horseId === null) return setError('Choose which horse this line is for, or “Not for one horse”.');
    setBusy(true);
    const { error: e } = await supabase.from('invoice_lines').insert({
      business_id: businessId,
      invoice_id: invoiceId,
      horse_id: horseId === NO_HORSE ? null : horseId,
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
      {horses.length > 0 ? (
        <ChoiceList
          label="Which horse is this for?"
          options={[...horses.map((h) => ({ value: h.id, label: h.name })), { value: NO_HORSE, label: 'Not for one horse', note: 'Will not count towards any horse’s income' }]}
          value={horseId}
          onChange={setHorseId}
        />
      ) : null}
      <TextField label="Description" value={description} onChangeText={setDescription} placeholder="October livery" />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Unit price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="2500" />
        </View>
      </View>
      <ToggleRow label={`${taxLabel} applies`} value={taxApplies} onChange={setTaxApplies} last />
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
    if (!day) return setError(`Enter the date as ${dateOrderWords()}.`);
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
  letterhead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  party: { gap: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
});
