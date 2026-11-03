import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BlueHeader, Button, Card, EmptyState, ErrorText, HeaderIconButton, Loading } from '@/components/ui';
import { Colors, WideContentMaxWidth, Radius, Spacing, TabBarClearance } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type StallView = {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  horses: { id: string; name: string; expectedEnd: string | null }[];
};

type WaitingAction = { id: string; status: 'placed' | 'withdrawn' };

export default function StallsScreen() {
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WaitingAction | null>(null);

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const [stalls, assignments, waiting] = await Promise.all([
      supabase.from('stalls').select('id, name, kind, capacity, sort_order').eq('business_id', bid).eq('active', true).order('sort_order'),
      supabase
        .from('stall_assignments')
        .select('stall_id, expected_end_on, horses(id, name)')
        .eq('business_id', bid)
        .is('ended_on', null),
      supabase
        .from('waiting_list')
        .select('id, contact_name, horse_count, horse_description, requested_on, priority')
        .eq('business_id', bid)
        .eq('status', 'waiting')
        .order('priority', { ascending: false })
        .order('requested_on'),
    ]);

    const byStall = new Map<string, StallView['horses']>();
    for (const a of must(assignments) ?? []) {
      const h = a.horses as { id: string; name: string } | null;
      if (!h) continue;
      const list = byStall.get(a.stall_id) ?? [];
      list.push({ id: h.id, name: h.name, expectedEnd: a.expected_end_on });
      byStall.set(a.stall_id, list);
    }

    const views: StallView[] = (must(stalls) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      capacity: s.capacity,
      horses: byStall.get(s.id) ?? [],
    }));
    return { stalls: views, waiting: must(waiting) ?? [] };
  }, [bid]);

  const createKimcoLayout = async () => {
    setActionError(null);
    setCreating(true);
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => ({
        business_id: bid,
        name: `Stall ${i + 1}`,
        kind: 'training_stall',
        capacity: 1,
        sort_order: i + 1,
      })),
      { business_id: bid, name: 'Broodmare camp', kind: 'camp', capacity: 40, sort_order: 100 },
    ];
    const { error: e } = await supabase.from('stalls').insert(rows);
    if (e) setActionError(e.message);
    await reload();
    setCreating(false);
  };

  const updateWaiting = async (action: WaitingAction) => {
    if (confirm?.id !== action.id || confirm.status !== action.status) {
      setConfirm(action);
      return;
    }
    setActionError(null);
    const { error: e } = await supabase.from('waiting_list').update({ status: action.status }).eq('id', action.id);
    if (e) setActionError(e.message);
    setConfirm(null);
    await reload();
  };

  const training = data?.stalls.filter((s) => s.kind === 'training_stall') ?? [];
  const camps = data?.stalls.filter((s) => s.kind === 'camp') ?? [];
  const freeStall = training.find((s) => s.horses.length < s.capacity);
  const nextClient = data?.waiting[0];
  const inUse = training.filter((s) => s.horses.length > 0).length;

  const openStall = (id: string) => router.push({ pathname: '/stall/[id]', params: { id } });

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Stalls"
        subtitle={data && training.length ? `${inUse} of ${training.length} training stalls in use` : undefined}
        wide
        right={
          isManager ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeaderIconButton icon="more" label="Manage stalls" onPress={() => router.push('/stall/manage')} />
              <HeaderIconButton icon="add" label="Add to waiting list" onPress={() => router.push('/waiting/new')} />
            </View>
          ) : null
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}>
          <ErrorText message={error ?? actionError} />

          {data && data.stalls.length === 0 ? (
            <EmptyState
              title="No stalls yet"
              message={isManager ? 'Start with 7 training stalls and one broodmare camp. You can rename or change them later.' : 'Your Manager has not set up stalls yet.'}
              action={isManager ? <Button title="Set up 7 stalls and a camp" onPress={createKimcoLayout} loading={creating} /> : null}
            />
          ) : null}

          {freeStall && nextClient ? (
            <View style={styles.suggestion} accessibilityLiveRegion="polite">
              <AppText variant="bodyStrong" color={Colors.darkGold}>
                {freeStall.name} is free
              </AppText>
              <AppText>
                Next on the waiting list: <AppText variant="bodyStrong">{nextClient.contact_name}</AppText>
              </AppText>
            </View>
          ) : null}

          {training.length ? (
            <>
              <AppText variant="small">Tap a stall to put a horse in it or see who is there.</AppText>
              <View style={styles.grid}>
                {training.map((s) => (
                  <StallCard key={s.id} stall={s} onPress={() => openStall(s.id)} />
                ))}
                {camps.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${c.horses.length} ${c.horses.length === 1 ? 'mare' : 'mares'}`}
                    onPress={() => openStall(c.id)}
                    style={[styles.stall, styles.camp]}>
                    <AppText variant="label" color={Colors.gold}>
                      {c.name.toUpperCase()}
                    </AppText>
                    <AppText variant="bodyStrong" color={Colors.surface}>
                      {c.horses.length} {c.horses.length === 1 ? 'mare' : 'mares'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {data && data.stalls.length > 0 ? (
            <Card>
              <AppText variant="heading" accessibilityRole="header">
                Waiting list
              </AppText>
              {data.waiting.length === 0 ? (
                <AppText muted>{isManager ? 'Nobody is waiting. Tap + at the top to add someone.' : 'Nobody is waiting.'}</AppText>
              ) : null}
              {data.waiting.map((w, i) => (
                <View key={w.id} style={[styles.waitRow, i < data.waiting.length - 1 && styles.divider]}>
                  <View style={[styles.position, i === 0 && { backgroundColor: Colors.gold }]}>
                    <AppText variant="bodyStrong" color={Colors.deepBlue}>
                      {i + 1}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">{w.contact_name}</AppText>
                    <AppText variant="small">
                      {w.horse_count} horse{w.horse_count === 1 ? '' : 's'}
                      {w.horse_description ? ` · ${w.horse_description}` : ''} · waiting since {formatDate(w.requested_on)}
                    </AppText>
                    {isManager ? (
                      <View style={styles.waitActions}>
                        <WaitingButton
                          label="Placed"
                          confirmLabel="Tap again: placed"
                          active={confirm?.id === w.id && confirm.status === 'placed'}
                          onPress={() => updateWaiting({ id: w.id, status: 'placed' })}
                        />
                        <WaitingButton
                          label="Remove"
                          confirmLabel="Tap again: remove"
                          active={confirm?.id === w.id && confirm.status === 'withdrawn'}
                          onPress={() => updateWaiting({ id: w.id, status: 'withdrawn' })}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function WaitingButton({ label, confirmLabel, active, onPress }: { label: string; confirmLabel: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? confirmLabel : label}
      onPress={onPress}
      hitSlop={6}
      style={[styles.waitButton, active && styles.waitButtonActive]}>
      <AppText variant="small" color={active ? Colors.deepBlue : Colors.royalBlue} style={{ fontWeight: '700' }}>
        {active ? confirmLabel : label}
      </AppText>
    </Pressable>
  );
}

function StallCard({ stall, onPress }: { stall: StallView; onPress: () => void }) {
  const horse = stall.horses[0];
  if (!horse) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${stall.name}, empty`} onPress={onPress} style={[styles.stall, styles.empty]}>
        <AppText variant="label">{stall.name.toUpperCase()}</AppText>
        <AppText variant="bodyStrong" muted>
          Empty
        </AppText>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${stall.name}, ${horse.name}`}
      onPress={onPress}
      style={[styles.stall, horse.expectedEnd ? styles.leaving : null]}>
      <AppText variant="label" color={horse.expectedEnd ? Colors.darkGold : Colors.royalBlue}>
        {stall.name.toUpperCase()}
        {horse.expectedEnd ? ` · LEAVING ${formatDate(horse.expectedEnd).toUpperCase()}` : ''}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {horse.name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: WideContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: TabBarClearance },
  suggestion: {
    backgroundColor: Colors.lightGold,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 14,
    gap: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stall: {
    width: '48.8%',
    minHeight: 64,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 2,
  },
  empty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#8A93AD' },
  leaving: { borderColor: Colors.mutedGold },
  camp: { backgroundColor: Colors.deepBlue, borderColor: Colors.deepBlue },
  waitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  position: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 6 },
  waitButton: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.royalBlue,
    justifyContent: 'center',
  },
  waitButtonActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
});
