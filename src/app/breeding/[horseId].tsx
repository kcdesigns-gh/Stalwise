import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, ErrorText, Loading, Segmented, TextField } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatDate, parseDayMonthYear, toDayMonthYear, todayIso, dateOrderWords, dateHint } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type Method = 'natural' | 'ai_fresh' | 'ai_chilled' | 'ai_frozen' | 'embryo_transfer';
const METHOD_LABELS: Record<Method, string> = {
  natural: 'Natural',
  ai_fresh: 'AI (fresh)',
  ai_chilled: 'AI (chilled)',
  ai_frozen: 'AI (frozen)',
  embryo_transfer: 'Embryo transfer',
};

type PregnancyResult = 'in_foal' | 'not_in_foal' | 'twins' | 'lost' | 'unsure';
const RESULT_LABELS: Record<PregnancyResult, string> = {
  in_foal: 'In foal',
  not_in_foal: 'Not in foal',
  twins: 'Twins',
  lost: 'Lost',
  unsure: 'Unsure',
};

export default function BreedingScreen() {
  const insets = useSafeAreaInsets();
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading, reload } = useScreenData(async () => {
    const [horse, events] = await Promise.all([
      supabase.from('horses').select('id, name').eq('id', horseId).single(),
      supabase
        .from('breeding_events')
        .select('id, stallion_name, method, bred_on, notes, pregnancy_checks(id, checked_on, result, expected_foaling_on), foalings(id, foaled_on, outcome)')
        .eq('mare_id', horseId)
        .order('bred_on', { ascending: false }),
    ]);
    return { horse: must(horse), events: must(events) ?? [] };
  }, [horseId]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Breeding" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can see the full breeding record." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Breeding" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Breeding" subtitle={data.horse.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error} />

        <AddBreedingCard bid={bid} horseId={horseId} onAdded={reload} />

        {data.events.length === 0 ? <Card><AppText muted>No breeding events yet.</AppText></Card> : null}

        {data.events.map((ev) => (
          <Card key={ev.id}>
            <AppText variant="heading">{ev.stallion_name ?? 'Stallion'} · {METHOD_LABELS[ev.method as Method] ?? ev.method}</AppText>
            <AppText variant="small">Bred {formatDate(ev.bred_on)}</AppText>

            {(ev.pregnancy_checks ?? []).map((c) => (
              <DetailRow key={c.id} label={`Check ${formatDate(c.checked_on)}`} value={RESULT_LABELS[c.result as PregnancyResult] ?? c.result} />
            ))}
            {(ev.foalings ?? []).map((f) => (
              <DetailRow key={f.id} label={`Foaled ${formatDate(f.foaled_on)}`} value={f.outcome} />
            ))}

            <AddCheckAndFoalCard bid={bid} mareId={horseId} breedingEventId={ev.id} onAdded={reload} />
          </Card>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddBreedingCard({ bid, horseId, onAdded }: { bid: string; horseId: string; onAdded: () => Promise<void> }) {
  const [stallionName, setStallionName] = useState('');
  const [method, setMethod] = useState<Method>('natural');
  const [bredOn, setBredOn] = useState(toDayMonthYear(todayIso()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!stallionName.trim()) return setError('Enter the stallion.');
    const day = parseDayMonthYear(bredOn);
    if (!day) return setError(`Enter the date as ${dateOrderWords()}.`);
    setBusy(true);
    const { error: e } = await supabase.from('breeding_events').insert({
      business_id: bid,
      mare_id: horseId,
      stallion_name: stallionName.trim(),
      method,
      bred_on: day,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setStallionName('');
    setNotes('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Record a breeding</AppText>
      <TextField label="Stallion" value={stallionName} onChangeText={setStallionName} />
      <Segmented
        label="Method"
        options={(Object.keys(METHOD_LABELS) as Method[]).map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
        value={method}
        onChange={setMethod}
      />
      <TextField label="Date" value={bredOn} onChangeText={setBredOn} keyboardType="numbers-and-punctuation" />
      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <ErrorText message={error} />
      <Button icon="add" title="Save" onPress={add} loading={busy} />
    </Card>
  );
}

function AddCheckAndFoalCard({
  bid,
  mareId,
  breedingEventId,
  onAdded,
}: {
  bid: string;
  mareId: string;
  breedingEventId: string;
  onAdded: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'check' | 'foal'>('check');
  const [checkedOn, setCheckedOn] = useState(toDayMonthYear(todayIso()));
  const [result, setResult] = useState<PregnancyResult>('in_foal');
  const [expectedFoaling, setExpectedFoaling] = useState('');
  const [foaledOn, setFoaledOn] = useState(toDayMonthYear(todayIso()));
  const [outcome, setOutcome] = useState<'live' | 'stillborn' | 'died'>('live');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCheck = async () => {
    setError(null);
    const day = parseDayMonthYear(checkedOn);
    if (!day) return setError(`Enter the check date as ${dateOrderWords()}.`);
    const expected = expectedFoaling.trim() ? parseDayMonthYear(expectedFoaling) : null;
    if (expectedFoaling.trim() && !expected) return setError(`Enter the expected foaling date as ${dateOrderWords()}.`);
    setBusy(true);
    const { error: e } = await supabase.from('pregnancy_checks').insert({
      business_id: bid,
      breeding_event_id: breedingEventId,
      checked_on: day,
      result,
      expected_foaling_on: expected,
    });
    setBusy(false);
    if (e) return setError(e.message);
    await onAdded();
  };

  const addFoaling = async () => {
    setError(null);
    const day = parseDayMonthYear(foaledOn);
    if (!day) return setError(`Enter the foaling date as ${dateOrderWords()}.`);
    setBusy(true);
    const { error: e } = await supabase.from('foalings').insert({
      business_id: bid,
      breeding_event_id: breedingEventId,
      mare_id: mareId,
      foaled_on: day,
      outcome,
    });
    setBusy(false);
    if (e) return setError(e.message);
    await onAdded();
  };

  return (
    <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
      <Segmented
        label="Add"
        options={[
          { value: 'check', label: 'Pregnancy check' },
          { value: 'foal', label: 'Foaling' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'check' ? (
        <>
          <TextField label="Checked on" value={checkedOn} onChangeText={setCheckedOn} keyboardType="numbers-and-punctuation" />
          <Segmented label="Result" options={(Object.keys(RESULT_LABELS) as PregnancyResult[]).map((r) => ({ value: r, label: RESULT_LABELS[r] }))} value={result} onChange={setResult} />
          <TextField label="Expected foaling (optional)" value={expectedFoaling} onChangeText={setExpectedFoaling} placeholder={dateHint()} />
          <ErrorText message={error} />
          <Button kind="secondary" icon="add" title="Add check" onPress={addCheck} loading={busy} />
        </>
      ) : (
        <>
          <TextField label="Foaled on" value={foaledOn} onChangeText={setFoaledOn} keyboardType="numbers-and-punctuation" />
          <Segmented
            label="Outcome"
            options={[
              { value: 'live', label: 'Live' },
              { value: 'stillborn', label: 'Stillborn' },
              { value: 'died', label: 'Died' },
            ]}
            value={outcome}
            onChange={setOutcome}
          />
          <ErrorText message={error} />
          <Button kind="secondary" icon="add" title="Add foaling" onPress={addFoaling} loading={busy} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
