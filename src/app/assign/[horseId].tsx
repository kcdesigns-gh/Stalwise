import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ChoiceList, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, parseDayMonthYear, toDayMonthYear } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type StallOption = { id: string; name: string; kind: string; capacity: number; used: number };
type Current = { stallId: string; stallName: string; since: string; leaving: string | null };

export default function AssignScreen() {
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading, reload } = useScreenData(async () => {
    const [horse, stalls, open] = await Promise.all([
      supabase.from('horses').select('id, name').eq('id', horseId).single(),
      supabase.from('stalls').select('id, name, kind, capacity, sort_order').eq('business_id', bid).eq('active', true).order('sort_order'),
      supabase.from('stall_assignments').select('stall_id, horse_id, started_on, expected_end_on').eq('business_id', bid).is('ended_on', null),
    ]);

    const rows = must(open);
    const used = new Map<string, number>();
    for (const r of rows) used.set(r.stall_id, (used.get(r.stall_id) ?? 0) + 1);

    const stallList: StallOption[] = must(stalls).map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      capacity: s.capacity,
      used: used.get(s.id) ?? 0,
    }));

    const mine = rows.find((r) => r.horse_id === horseId);
    const current: Current | null = mine
      ? {
          stallId: mine.stall_id,
          stallName: stallList.find((s) => s.id === mine.stall_id)?.name ?? 'a stall',
          since: mine.started_on,
          leaving: mine.expected_end_on,
        }
      : null;

    return { horse: must(horse), stalls: stallList, current };
  }, [bid, horseId]);

  if (!isManager) {
    return (
      <>
        <BlueHeader title="Stall" showBack />
        <ErrorText message="Only the Manager can change stalls." />
      </>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <>
        <BlueHeader title="Stall" showBack />
        <ErrorText message={error ?? 'This horse could not be found.'} />
      </>
    );
  }

  return (
    <AssignForm
      key={`${horseId}-${data.current?.stallId ?? 'none'}-${data.current?.leaving ?? ''}`}
      horseId={horseId}
      horseName={data.horse.name}
      stalls={data.stalls}
      current={data.current}
      reload={reload}
    />
  );
}

function AssignForm({
  horseId,
  horseName,
  stalls,
  current,
  reload,
}: {
  horseId: string;
  horseName: string;
  stalls: StallOption[];
  current: Current | null;
  reload: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState<string | null>(null);
  const [leaveNew, setLeaveNew] = useState('');
  const [leaveNow, setLeaveNow] = useState(current?.leaving ? toDayMonthYear(current.leaving) : '');
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const options = stalls
    .filter((s) => s.id !== current?.stallId && s.used < s.capacity)
    .map((s) => ({
      value: s.id,
      label: s.name,
      note: s.kind === 'camp' ? `${s.used} of ${s.capacity} in the camp` : 'Free',
    }));
  const chosen = stalls.find((s) => s.id === target) ?? null;

  const readDate = (text: string): string | null | undefined => {
    if (!text.trim()) return null;
    return parseDayMonthYear(text) ?? undefined;
  };

  const run = async (work: () => PromiseLike<{ error: { message: string } | null }>, after: () => Promise<void> | void) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const { error: e } = await work();
    if (e) setError(e.message);
    else await after();
    setBusy(false);
  };

  const place = async () => {
    if (!target) return setError('Choose a stall first.');
    const day = chosen?.kind === 'camp' ? null : readDate(leaveNew);
    if (day === undefined) return setError('Enter the leaving date as day/month/year, for example 15/11/2026.');
    await run(
      () => supabase.rpc('assign_horse_to_stall', { horse: horseId, stall: target, expected_end: day ?? undefined }),
      () => router.back(),
    );
  };

  const saveLeaving = async () => {
    if (!current) return;
    const day = readDate(leaveNow);
    if (day === undefined) return setError('Enter the leaving date as day/month/year, for example 15/11/2026.');
    await run(
      () => supabase.rpc('assign_horse_to_stall', { horse: horseId, stall: current.stallId, expected_end: day ?? undefined }),
      async () => {
        setNotice(day ? 'Leaving date saved.' : 'Leaving date cleared.');
        await reload();
      },
    );
  };

  const takeOut = async () => {
    if (!confirmOut) {
      setConfirmOut(true);
      return;
    }
    await run(() => supabase.rpc('remove_horse_from_stall', { horse: horseId }), () => router.back());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Stall" subtitle={horseName} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error} />
        {notice ? <AppText color={Colors.success}>{notice}</AppText> : null}

        {current ? (
          <Card gold>
            <AppText variant="label">Currently in</AppText>
            <AppText variant="title">{current.stallName}</AppText>
            <AppText variant="small">Since {formatDate(current.since)}</AppText>
            <TextField
              label="Expected to leave on (optional)"
              value={leaveNow}
              onChangeText={setLeaveNow}
              keyboardType="numbers-and-punctuation"
              placeholder="dd/mm/yyyy"
              hint="Leave empty if there is no leaving date."
            />
            <Button kind="secondary" title="Save leaving date" onPress={saveLeaving} loading={busy} />
          </Card>
        ) : (
          <Card gold>
            <AppText variant="bodyStrong">{horseName} is not in a stall.</AppText>
          </Card>
        )}

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {current ? 'Move to another stall' : 'Put in a stall'}
          </AppText>
          {stalls.length === 0 ? (
            <AppText muted>No stalls are set up yet. Open the Stalls tab to set them up.</AppText>
          ) : options.length === 0 ? (
            <AppText muted>Every other stall is full.</AppText>
          ) : (
            <>
              <ChoiceList label="Which stall?" options={options} value={target} onChange={setTarget} />
              {chosen && chosen.kind !== 'camp' ? (
                <TextField
                  label="Expected to leave on (optional)"
                  value={leaveNew}
                  onChangeText={setLeaveNew}
                  keyboardType="numbers-and-punctuation"
                  placeholder="dd/mm/yyyy"
                />
              ) : null}
              <Button
                title={current ? 'Move horse' : 'Put in stall'}
                onPress={place}
                loading={busy}
                disabled={!target}
              />
            </>
          )}
        </Card>

        {current ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Take out of the stall
            </AppText>
            <AppText variant="small">The horse stays on the yard. It just won’t have a stall until you put it in another one.</AppText>
            <Button kind="secondary" title={confirmOut ? 'Tap again to take out' : 'Take out of stall'} onPress={takeOut} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
