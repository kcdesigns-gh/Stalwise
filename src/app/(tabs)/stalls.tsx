import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BlueHeader, Button, Card, EmptyState, ErrorText, Loading } from '@/components/ui';
import { Colors, ContentMaxWidth, Radius, Spacing, TabBarClearance } from '@/constants/theme';
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

export default function StallsScreen() {
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        .select('id, contact_name, horse_count, requested_on, priority')
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

  const training = data?.stalls.filter((s) => s.kind === 'training_stall') ?? [];
  const camps = data?.stalls.filter((s) => s.kind === 'camp') ?? [];
  const freeStall = training.find((s) => s.horses.length < s.capacity);
  const nextClient = data?.waiting[0];
  const inUse = training.filter((s) => s.horses.length > 0).length;

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Stalls"
        subtitle={data && training.length ? `${inUse} of ${training.length} training stalls in use` : undefined}
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
            <View style={styles.grid}>
              {training.map((s) => (
                <StallCard key={s.id} stall={s} />
              ))}
              {camps.map((c) => (
                <View key={c.id} style={[styles.stall, styles.camp]}>
                  <AppText variant="label" color={Colors.gold}>
                    {c.name.toUpperCase()}
                  </AppText>
                  <AppText variant="bodyStrong" color={Colors.surface}>
                    {c.horses.length} {c.horses.length === 1 ? 'mare' : 'mares'}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {data && data.stalls.length > 0 ? (
            <Card>
              <AppText variant="heading" accessibilityRole="header">
                Waiting list
              </AppText>
              {data.waiting.length === 0 ? <AppText muted>Nobody is waiting.</AppText> : null}
              {data.waiting.map((w, i) => (
                <View key={w.id} style={[styles.waitRow, i < data.waiting.length - 1 && styles.divider]}>
                  <View style={[styles.position, i === 0 && { backgroundColor: Colors.gold }]}>
                    <AppText variant="bodyStrong" color={Colors.deepBlue}>
                      {i + 1}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{w.contact_name}</AppText>
                    <AppText variant="small">
                      {w.horse_count} horse{w.horse_count === 1 ? '' : 's'} · waiting since {formatDate(w.requested_on)}
                    </AppText>
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

function StallCard({ stall }: { stall: StallView }) {
  const horse = stall.horses[0];
  if (!horse) {
    return (
      <View style={[styles.stall, styles.empty]}>
        <AppText variant="label">{stall.name.toUpperCase()}</AppText>
        <AppText variant="bodyStrong" muted>
          Empty
        </AppText>
      </View>
    );
  }
  return (
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/horse/[id]', params: { id: horse.id } })}
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
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: TabBarClearance },
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
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  position: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

