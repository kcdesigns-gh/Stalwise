import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueHeader, Button, Card, ErrorText, Loading, TextField, ToggleRow } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { parseDayMonthYear, parseMoney, toDayMonthYear, dateOrderWords } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function EditCostScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useBusiness();

  const { data, error, loading } = useScreenData(
    async () =>
      must(
        await supabase
          .from('cost_entries')
          .select('id, cost_on, description, amount, billable, notes, source, cost_categories(name)')
          .eq('id', id)
          .single(),
      ),
    [id],
  );

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit cost" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can edit a cost." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit cost" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This cost could not be found.'} />
        </View>
      </View>
    );
  }
  if (data.source !== 'manual') {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit cost" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="This cost was logged automatically and can't be edited here." />
        </View>
      </View>
    );
  }

  return <EditForm key={data.id} cost={data} insetsBottom={insets.bottom} />;
}

function EditForm({
  cost,
  insetsBottom,
}: {
  cost: { id: string; cost_on: string; description: string | null; amount: number; billable: boolean; notes: string | null; cost_categories: { name: string } | null };
  insetsBottom: number;
}) {
  const { business } = useBusiness();
  const currency = business!.currency_code;
  const [date, setDate] = useState(toDayMonthYear(cost.cost_on));
  const [description, setDescription] = useState(cost.description ?? '');
  const [amount, setAmount] = useState(String(cost.amount));
  const [billable, setBillable] = useState(cost.billable);
  const [notes, setNotes] = useState(cost.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const day = parseDayMonthYear(date);
    if (!day) return setError(`Enter the date as ${dateOrderWords()}.`);
    const money = parseMoney(amount);
    if (money === null || money < 0) return setError('Enter the amount, for example 650.');
    if (!description.trim()) return setError('Describe the cost.');

    setBusy(true);
    const { error: e } = await supabase
      .from('cost_entries')
      .update({ cost_on: day, description: description.trim(), amount: money, unit_cost: money, quantity: 1, billable, notes: notes.trim() || null })
      .eq('id', cost.id);
    setBusy(false);
    if (e) return setError(e.message);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Edit cost" subtitle={cost.cost_categories?.name ?? undefined} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label="Description" value={description} onChangeText={setDescription} autoCapitalize="sentences" />
          <TextField label={`Amount (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
          <ToggleRow label="Charge this to the owner on an invoice" value={billable} onChange={setBillable} last />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </Card>
        <ErrorText message={error} />
        <Button title="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
