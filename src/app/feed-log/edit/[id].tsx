import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueHeader, Button, Card, ErrorText, Loading, TextField } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { parseDayMonthYear, parseQuantity, toDayMonthYear, dateOrderWords } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function EditFeedLogScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useBusiness();

  const { data, error, loading } = useScreenData(
    async () =>
      must(
        await supabase
          .from('feed_logs')
          .select('id, fed_on, quantity, notes, products(name, dose_label)')
          .eq('id', id)
          .single(),
      ),
    [id],
  );

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit feed" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can edit a feed log." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Edit feed" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This feed log could not be found.'} />
        </View>
      </View>
    );
  }
  return <EditForm key={data.id} log={data} insetsBottom={insets.bottom} />;
}

function EditForm({
  log,
  insetsBottom,
}: {
  log: { id: string; fed_on: string; quantity: number; notes: string | null; products: { name: string; dose_label: string } | null };
  insetsBottom: number;
}) {
  const [date, setDate] = useState(toDayMonthYear(log.fed_on));
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [notes, setNotes] = useState(log.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const day = parseDayMonthYear(date);
    if (!day) return setError(`Enter the date as ${dateOrderWords()}.`);
    const qty = parseQuantity(quantity);
    if (qty === null || qty <= 0) return setError('Enter how much was given, for example 2.');

    setBusy(true);
    const { error: e } = await supabase.from('feed_logs').update({ fed_on: day, quantity: qty, notes: notes.trim() || null }).eq('id', log.id);
    setBusy(false);
    if (e) return setError(e.message);
    router.back();
  };

  const remove = async () => {
    setBusy(true);
    const { error: e } = await supabase.from('feed_logs').delete().eq('id', log.id);
    setBusy(false);
    if (e) return setError(e.message);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Edit feed" subtitle={log.products?.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label={`Quantity (${log.products?.dose_label ?? 'unit'}s)`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
          <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </Card>
        <ErrorText message={error} />
        <Button title="Save changes" onPress={save} loading={busy} />
        <Button kind="secondary" title="Remove this feed entry" onPress={remove} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
