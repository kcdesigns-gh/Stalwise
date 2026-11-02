import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, EmptyState, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatMoney, parseMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

export default function SharedCostsScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const monthDate = monthKey(year, month);

  const { data, error, loading, reload } = useScreenData(
    async () => must(await supabase.from('shared_cost_pools').select('id, name, amount, locked, notes').eq('business_id', bid).eq('month', monthDate).order('created_at')),
    [bid, monthDate],
  );

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error2, setError2] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Shared costs" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can manage shared costs." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setResult(null);
  };

  const addPool = async () => {
    setError2(null);
    if (!name.trim()) return setError2('Enter what this shared cost is for, for example Rent.');
    const amt = parseMoney(amount);
    if (amt === null || amt < 0) return setError2('Enter the amount, for example 12000.');
    setBusy(true);
    const { error: e } = await supabase.from('shared_cost_pools').insert({ business_id: bid, name: name.trim(), month: monthDate, amount: amt, notes: notes.trim() || null });
    setBusy(false);
    if (e) return setError2(e.message);
    setName('');
    setAmount('');
    setNotes('');
    await reload();
  };

  const toggleLock = async (id: string, locked: boolean) => {
    setError2(null);
    setBusy(true);
    const { error: e } = await supabase.from('shared_cost_pools').update({ locked }).eq('id', id);
    if (e) setError2(e.message);
    await reload();
    setBusy(false);
  };

  const run = async () => {
    setError2(null);
    setResult(null);
    setRunning(true);
    const { data: res, error: e } = await supabase.rpc('run_month_allocation', { bid, for_month: monthDate });
    setRunning(false);
    if (e) return setError2(e.message);
    const r = res as { pools_split: number; horse_days: number } | null;
    setResult(
      r
        ? `Split ${r.pools_split} pool${r.pools_split === 1 ? '' : 's'} over ${r.horse_days} horse-day${r.horse_days === 1 ? '' : 's'} this month.`
        : 'Done.',
    );
    await reload();
  };

  const total = (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Shared costs" showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error} />
        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} hitSlop={8}>
            <AppText variant="bodyStrong" color={Colors.royalBlue}>‹ Prev</AppText>
          </Pressable>
          <AppText variant="heading">{MONTH_NAMES[month]} {year}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} hitSlop={8}>
            <AppText variant="bodyStrong" color={Colors.royalBlue}>Next ›</AppText>
          </Pressable>
        </View>

        <Card gold>
          <AppText variant="heading">Add a shared cost</AppText>
          <AppText variant="small">Things like rent or staff wages that cover every horse, not one in particular. Split equally per horse per day on the yard.</AppText>
          <TextField label="What for" value={name} onChangeText={setName} placeholder="Rent" />
          <TextField label={`Amount (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="12000" />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
          <ErrorText message={error2} />
          <Button icon="add" title="Add" onPress={addPool} loading={busy} disabled={!name.trim() || !amount.trim()} />
        </Card>

        <Card>
          <AppText variant="heading">This month&rsquo;s pools</AppText>
          {!data || data.length === 0 ? (
            <EmptyState title="Nothing added yet" message="Add rent, wages or other shared costs above." />
          ) : (
            data.map((p, i) => (
              <DetailRow
                key={p.id}
                label={p.locked ? `${p.name} 🔒` : p.name}
                value={formatMoney(p.amount, currency)}
                onPress={() => toggleLock(p.id, !p.locked)}
                last={i === data.length - 1}
              />
            ))
          )}
          {data && data.length > 0 ? <AppText variant="small">Total: {formatMoney(total, currency)}. Tap a pool to lock or unlock it.</AppText> : null}
        </Card>

        {data && data.length > 0 ? (
          <Card>
            <AppText variant="heading">Split across horses</AppText>
            <AppText variant="small">
              Splits every unlocked pool above equally across every horse by how many days it was on the yard this month. Locked pools are left as they are. Safe to run again — it replaces the previous split.
            </AppText>
            {result ? <AppText variant="small" color={Colors.success}>{result}</AppText> : null}
            <Button title="Run the split for this month" onPress={run} loading={running} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
});
