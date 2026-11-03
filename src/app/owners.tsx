import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, BlueHeader, EmptyState, ErrorText, HeaderIconButton, Loading } from '@/components/ui';
import { Colors, WideContentMaxWidth, Radius, Spacing, TabBarClearance } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function OwnersScreen() {
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const { data, error, loading } = useScreenData(async () => {
    const [owners, horses] = await Promise.all([
      supabase
        .from('owners')
        .select('id, name, is_self, email, phone')
        .eq('business_id', bid)
        .is('archived_at', null)
        .order('is_self', { ascending: false })
        .order('name'),
      supabase.from('horses').select('id, current_owner_id').eq('business_id', bid).is('archived_at', null),
    ]);
    const counts = new Map<string, number>();
    for (const h of must(horses) ?? []) {
      if (!h.current_owner_id) continue;
      counts.set(h.current_owner_id, (counts.get(h.current_owner_id) ?? 0) + 1);
    }
    return (must(owners) ?? []).map((o) => ({ ...o, horseCount: counts.get(o.id) ?? 0 }));
  }, [bid]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Owners" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can view owners." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Owners"
        subtitle={data ? `${data.length} on file` : undefined}
        showBack
        right={<HeaderIconButton icon="add" label="Add an owner" onPress={() => router.push('/owner/new')} />}
        wide
      />
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ErrorText message={error} />}
        ListEmptyComponent={<EmptyState title="No owners yet" message="Add a client, or they're added automatically when you add their horse." />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/owner/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{item.is_self ? `${item.name} (own)` : item.name}</AppText>
              <AppText variant="small" numberOfLines={1}>
                {[item.phone, item.email].filter(Boolean).join(' · ') || 'No contact details yet'}
              </AppText>
            </View>
            <Badge label={`${item.horseCount} horse${item.horseCount === 1 ? '' : 's'}`} tone="muted" />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', maxWidth: WideContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: 10, paddingBottom: TabBarClearance },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 64,
  },
});
