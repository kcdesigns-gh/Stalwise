import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ErrorText, Loading, Segmented, TextField, ToggleRow } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type StallKind = 'training_stall' | 'camp';
type StallRow = { id: string; name: string; kind: StallKind; capacity: number; sort_order: number; active: boolean };

export default function ManageStallsScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading, reload } = useScreenData(
    async () =>
      must(
        await supabase
          .from('stalls')
          .select('id, name, kind, capacity, sort_order, active')
          .eq('business_id', bid)
          .order('sort_order'),
      ) as StallRow[],
    [bid],
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Manage stalls" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can change stalls." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  // A stall can be deleted only when it is empty and has never held a horse.
  // One with a history is kept (switched off instead) so past records stay intact.
  const remove = async (stall: StallRow) => {
    setActionError(null);
    setBusyId(stall.id);
    const { count, error: countError } = await supabase
      .from('stall_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('stall_id', stall.id)
      .is('ended_on', null);
    if (countError) {
      setActionError(countError.message);
    } else if ((count ?? 0) > 0) {
      setActionError(`${stall.name} still has a horse in it. Move the horse out first, then delete it.`);
    } else {
      const { data: gone, error: e } = await supabase.from('stalls').delete().eq('id', stall.id).select('id');
      if (e?.code === '23503') {
        setActionError(
          `${stall.name} has held horses before, so its history is kept and it can't be deleted. Switch off "In use" to take it off the stall board.`,
        );
      } else if (e) {
        setActionError(e.message);
      } else if (!gone?.length) {
        setActionError(`${stall.name} could not be deleted. Please try again.`);
      }
    }
    await reload();
    setBusyId(null);
  };

  const save = async (id: string, patch: Partial<Pick<StallRow, 'name' | 'capacity' | 'active'>>) => {
    setActionError(null);
    setBusyId(id);
    const { error: e } = await supabase.from('stalls').update(patch).eq('id', id);
    if (e) setActionError(e.message);
    await reload();
    setBusyId(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Add and delete stalls" showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error ?? actionError} />

        <AddStallCard bid={bid} onAdded={reload} nextSortOrder={(data?.length ?? 0) + 1} />

        {(data ?? []).map((s) => (
          <StallRowCard
            key={s.id}
            stall={s}
            busy={busyId === s.id}
            onSave={(patch) => save(s.id, patch)}
            onDelete={() => remove(s)}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StallRowCard({
  stall,
  busy,
  onSave,
  onDelete,
}: {
  stall: StallRow;
  busy: boolean;
  onSave: (patch: Partial<Pick<StallRow, 'name' | 'capacity' | 'active'>>) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(stall.name);
  const [capacity, setCapacity] = useState(String(stall.capacity));

  const changed = name.trim() !== stall.name || capacity !== String(stall.capacity);

  return (
    <Card style={!stall.active ? { opacity: 0.6 } : undefined}>
      <View style={styles.twoCol}>
        <View style={{ flex: 2 }}>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Capacity"
            value={capacity}
            onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <AppText variant="small">{stall.kind === 'camp' ? 'Camp' : 'Training stall'}</AppText>
      <ToggleRow label="In use" value={stall.active} onChange={(active) => onSave({ active })} last={!changed} />
      {changed ? (
        <Button
          kind="secondary"
          title="Save"
          onPress={() => onSave({ name: name.trim() || stall.name, capacity: Math.max(1, Number(capacity) || 1) })}
          loading={busy}
        />
      ) : null}
      <Button
        kind="secondary"
        title={confirming ? `Tap again to delete ${stall.name}` : stall.kind === 'camp' ? 'Delete camp' : 'Delete stall'}
        onPress={() => {
          if (!confirming) return setConfirming(true);
          setConfirming(false);
          onDelete();
        }}
        loading={busy && !changed}
      />
      {confirming ? <Button kind="secondary" title="Cancel" onPress={() => setConfirming(false)} /> : null}
    </Card>
  );
}

function AddStallCard({ bid, onAdded, nextSortOrder }: { bid: string; onAdded: () => Promise<void>; nextSortOrder: number }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StallKind>('training_stall');
  const [capacity, setCapacity] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the stall or camp.');
    setBusy(true);
    const { error: e } = await supabase.from('stalls').insert({
      business_id: bid,
      name: name.trim(),
      kind,
      capacity: Math.max(1, Number(capacity) || 1),
      sort_order: nextSortOrder,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setName('');
    setCapacity('1');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a stall or camp</AppText>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Stall 8" autoCapitalize="words" />
      <Segmented
        label="Kind"
        options={[
          { value: 'training_stall', label: 'Training stall' },
          { value: 'camp', label: 'Camp' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TextField label="Capacity" value={capacity} onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
      <ErrorText message={error} />
      <Button icon="add" title="Add" onPress={add} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
});
