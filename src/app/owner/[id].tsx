import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Badge, BlueHeader, Button, Card, ErrorText, Loading, TextField, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, formatMoney } from '@/lib/format';
import { INVOICE_STATUS_LABELS } from '@/lib/labels';
import { supabase, type Tables } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type InvoiceRow = { id: string; invoice_number: string | null; status: string; issued_on: string | null; due_on: string | null; total: number; balance: number };
type Summary = { invoiced: number; paid: number; balance: number; overdue: number };

export default function OwnerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, reload } = useScreenData(async () => {
    const [owner, horses, invoices, bal] = await Promise.all([
      supabase.from('owners').select('*').eq('id', id).single(),
      supabase.from('horses').select('id, name, stock_number, current_purpose').eq('current_owner_id', id).is('archived_at', null).order('name'),
      supabase
        .from('invoices')
        .select('id, invoice_number, status, issued_on, due_on, created_at')
        .eq('owner_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('client_balances').select('invoiced, paid, balance, overdue_invoices').eq('owner_id', id).maybeSingle(),
    ]);
    const inv = must(invoices) ?? [];
    const totals = inv.length
      ? must(await supabase.from('invoice_totals').select('invoice_id, total, balance').in('invoice_id', inv.map((i) => i.id)))
      : [];
    const byId = new Map(totals.map((t) => [t.invoice_id, t]));
    const rows: InvoiceRow[] = inv.map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      status: i.status,
      issued_on: i.issued_on,
      due_on: i.due_on,
      total: Number(byId.get(i.id)?.total ?? 0),
      balance: Number(byId.get(i.id)?.balance ?? 0),
    }));
    const b = must(bal);
    const summary: Summary = {
      invoiced: Number(b?.invoiced ?? 0),
      paid: Number(b?.paid ?? 0),
      balance: Number(b?.balance ?? 0),
      overdue: Number(b?.overdue_invoices ?? 0),
    };
    return { owner: must(owner), horses: must(horses) ?? [], invoices: rows, summary };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Owner" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This owner could not be found.'} />
        </View>
      </View>
    );
  }
  return <OwnerView key={data.owner.id} owner={data.owner} horses={data.horses} invoices={data.invoices} summary={data.summary} insetsBottom={insets.bottom} reload={reload} />;
}

function OwnerView({
  owner,
  horses,
  invoices,
  summary,
  insetsBottom,
  reload,
}: {
  invoices: InvoiceRow[];
  summary: Summary;
  owner: Tables<'owners'>;
  horses: { id: string; name: string; stock_number: string | null; current_purpose: string }[];
  insetsBottom: number;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(owner.name);
  const [phone, setPhone] = useState(owner.phone ?? '');
  const [email, setEmail] = useState(owner.email ?? '');
  const [address, setAddress] = useState(owner.address ?? '');
  const [taxNumber, setTaxNumber] = useState(owner.tax_number ?? '');
  const [notes, setNotes] = useState(owner.notes ?? '');
  const [consent, setConsent] = useState(owner.updates_consent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { business } = useBusiness();
  const currency = business!.currency_code;
  const [confirmRemove, setConfirmRemove] = useState(false);

  const removeBlocker = horses.length > 0
    ? `${owner.name} still has ${horses.length} horse${horses.length === 1 ? '' : 's'} on the yard. Move or archive them first.`
    : summary.balance > 0
      ? `${owner.name} still owes ${formatMoney(summary.balance, currency)}. Settle or cancel the unpaid invoices first.`
      : null;

  const remove = async () => {
    setError(null);
    if (removeBlocker) return setError(removeBlocker);
    if (!confirmRemove) return setConfirmRemove(true);
    setBusy(true);
    const { error: e } = await supabase.from('owners').update({ archived_at: new Date().toISOString() }).eq('id', owner.id);
    setBusy(false);
    if (e) return setError(e.message);
    router.replace('/clients');
  };

  const save = async () => {
    setError(null);
    setNotice(null);
    if (!name.trim()) return setError('Enter the owner’s name.');
    setBusy(true);
    const { error: e } = await supabase
      .from('owners')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        tax_number: taxNumber.trim() || null,
        notes: notes.trim() || null,
        updates_consent: consent,
        updates_consent_at: consent && !owner.updates_consent ? new Date().toISOString() : owner.updates_consent_at,
      })
      .eq('id', owner.id);
    setBusy(false);
    if (e) return setError(e.message);
    setNotice('Saved.');
    await reload();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title={owner.is_self ? `${owner.name} (own)` : owner.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        {!owner.is_self ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Balance
            </AppText>
            <AppText variant="title">{formatMoney(summary.balance, currency)}</AppText>
            <AppText variant="small">
              {summary.balance > 0 ? 'Owing' : 'Nothing owing'} · invoiced {formatMoney(summary.invoiced, currency)} · paid {formatMoney(summary.paid, currency)}
              {summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ''}
            </AppText>
            <Button
              kind="secondary"
              icon="add"
              title="New invoice for this client"
              onPress={() => router.push({ pathname: '/invoice/new', params: { owner: owner.id } })}
            />
          </Card>
        ) : null}

        {!owner.is_self ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Invoices
            </AppText>
            {invoices.length === 0 ? <AppText muted>No invoices for this client yet.</AppText> : null}
            {invoices.map((inv, i) => (
              <Pressable
                key={inv.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } })}
                style={[styles.horseRow, i < invoices.length - 1 && styles.divider]}>
                <View style={{ gap: 2 }}>
                  <AppText variant="bodyStrong">{inv.invoice_number ?? 'Draft'}</AppText>
                  <AppText variant="small">{inv.due_on ? `Due ${formatDate(inv.due_on)}` : inv.issued_on ? `Issued ${formatDate(inv.issued_on)}` : ''}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText variant="bodyStrong">{formatMoney(inv.total, currency)}</AppText>
                  <Badge label={INVOICE_STATUS_LABELS[inv.status] ?? inv.status} tone={inv.status === 'paid' ? 'blue' : inv.status === 'part_paid' ? 'gold' : 'muted'} />
                </View>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {horses.length > 0 ? (
          <Card>
            <AppText variant="heading">Horses</AppText>
            {horses.map((h, i) => (
              <Pressable
                key={h.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/horse/[id]', params: { id: h.id } })}
                style={[styles.horseRow, i < horses.length - 1 && styles.divider]}>
                <AppText>{h.name}</AppText>
                <AppText variant="small">{h.stock_number ?? ''}</AppText>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {!owner.is_self ? (
          <Card gold>
            <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextField label="Address" value={address} onChangeText={setAddress} multiline />
            <TextField label="Tax / VAT number" value={taxNumber} onChangeText={setTaxNumber} />
            <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
            <ToggleRow label="Agreed to receive WhatsApp/email updates" value={consent} onChange={setConsent} last />
            <ErrorText message={error} />
            {notice ? <AppText variant="small" color={Colors.success}>{notice}</AppText> : null}
            <Button title="Save" onPress={save} loading={busy} />
          </Card>
        ) : null}

        {!owner.is_self ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Remove client
            </AppText>
            <AppText variant="small">
              Removing hides the client from your list. Their invoices and history are kept for your records.
            </AppText>
            {removeBlocker ? <AppText variant="small" color={Colors.danger}>{removeBlocker}</AppText> : null}
            <Button
              kind="secondary"
              title={confirmRemove ? 'Tap again to remove this client' : 'Remove client'}
              onPress={remove}
              disabled={busy}
            />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  horseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
