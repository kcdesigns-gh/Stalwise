import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, EmptyState, ErrorText, Loading, Segmented, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, parseDayMonthYear, toDayMonthYear, todayIso } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type CareType = 'deworming' | 'farrier' | 'dentist' | 'vaccination' | 'other';
const CARE_TYPES: { value: CareType; label: string }[] = [
  { value: 'deworming', label: 'Deworming' },
  { value: 'farrier', label: 'Farrier' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'other', label: 'Other' },
];
const CARE_LABELS: Record<string, string> = Object.fromEntries(CARE_TYPES.map((c) => [c.value, c.label]));

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { business, isManager, role } = useBusiness();
  const bid = business!.id;
  const canLog = role === 'manager' || role === 'trainer';

  const { data, error, loading, reload } = useScreenData(async () => {
    const [horse, schedules, events] = await Promise.all([
      supabase.from('horses').select('id, name').eq('id', horseId).single(),
      supabase.from('care_schedules').select('id, care_type, description, interval_days, next_due_on, active').eq('horse_id', horseId).order('next_due_on'),
      supabase.from('care_events').select('id, care_type, done_on, notes').eq('horse_id', horseId).order('done_on', { ascending: false }).limit(10),
    ]);
    return { horse: must(horse), schedules: must(schedules) ?? [], events: must(events) ?? [] };
  }, [horseId]);

  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Health" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }

  const markDone = async (scheduleId: string, careType: string) => {
    setError2(null);
    setBusy(true);
    const { error: e } = await supabase.from('care_events').insert({
      business_id: bid,
      horse_id: horseId,
      care_schedule_id: scheduleId,
      care_type: careType,
      done_on: todayIso(),
    });
    if (e) setError2(e.message);
    await reload();
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Health" subtitle={data.horse.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error ?? error2} />

        <Card>
          <AppText variant="heading">Reminders</AppText>
          {data.schedules.length === 0 ? (
            <EmptyState title="None set up" message={isManager ? 'Add one below.' : 'Ask your Manager to set these up.'} />
          ) : (
            data.schedules.map((s, i) => (
              <View key={s.id} style={[styles.row, i < data.schedules.length - 1 && styles.divider]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{CARE_LABELS[s.care_type] ?? s.care_type}</AppText>
                  <AppText variant="small">
                    Every {s.interval_days} days · next due {formatDate(s.next_due_on)}
                    {s.description ? ` · ${s.description}` : ''}
                  </AppText>
                </View>
                {canLog ? <Button kind="secondary" title="Mark done" onPress={() => markDone(s.id, s.care_type)} loading={busy} /> : null}
              </View>
            ))
          )}
        </Card>

        {isManager ? <AddScheduleCard bid={bid} horseId={horseId} onAdded={reload} /> : null}

        <Card>
          <AppText variant="heading">Recent care</AppText>
          {data.events.length === 0 ? <AppText muted>Nothing logged yet.</AppText> : null}
          {data.events.map((e, i) => (
            <DetailRow key={e.id} label={CARE_LABELS[e.care_type] ?? e.care_type} value={formatDate(e.done_on)} last={i === data.events.length - 1} />
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddScheduleCard({ bid, horseId, onAdded }: { bid: string; horseId: string; onAdded: () => Promise<void> }) {
  const [careType, setCareType] = useState<CareType>('deworming');
  const [intervalDays, setIntervalDays] = useState('90');
  const [nextDue, setNextDue] = useState(toDayMonthYear(todayIso()));
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const days = Number(intervalDays);
    if (!Number.isInteger(days) || days <= 0) return setError('Enter how many days between each one, for example 90.');
    const due = parseDayMonthYear(nextDue);
    if (!due) return setError('Enter the next due date as day/month/year.');
    setBusy(true);
    const { error: e } = await supabase.from('care_schedules').insert({
      business_id: bid,
      horse_id: horseId,
      care_type: careType,
      interval_days: days,
      next_due_on: due,
      description: description.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setDescription('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a reminder</AppText>
      <Segmented label="Type" options={CARE_TYPES} value={careType} onChange={setCareType} />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Every (days)" value={intervalDays} onChangeText={(t) => setIntervalDays(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Next due" value={nextDue} onChangeText={setNextDue} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <TextField label="Notes (optional)" value={description} onChangeText={setDescription} />
      <ErrorText message={error} />
      <Button icon="add" title="Add reminder" onPress={add} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
});
