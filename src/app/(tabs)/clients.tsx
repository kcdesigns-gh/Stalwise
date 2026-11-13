import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Badge, BlueHeader, EmptyState, ErrorText, HeaderIconButton, Loading, TextField } from '@/components/ui';
import { Colors, WideContentMaxWidth, Radius, Spacing, TabBarClearance } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function ClientsScreen() {
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;
  const [search, setSearch] = useState('');

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const [owners, horses, balances] = await Promise.all([
      supabase
        .from('owners')
        .select('id, name, is_self, email, phone')
        .eq('business_id', bid)
        .eq('is_self', false)
        .is('archived_at', null)
        .order('name'),
      supabase.from('horses').select('id, current_owner_id').eq('business_id', bid).is('archived_at', null),
      supabase.from('client_balances').select('owner_id, balance, overdue_invoices').eq('business_id', bid),
    ]);
    const counts = new Map<string, number>();
    for (const h of must(horses) ?? []) {
      if (!h.current_owner_id) continue;
      counts.set(h.current_owner_id, (counts.get(h.current_owner_id) ?? 0) + 1);
    }
    const bal = new Map((must(balances) ?? []).map((b) => [b.owner_id, b]));
    return (must(owners) ?? []).map((o) => ({
      ...o,
      horseCount: counts.get(o.id) ?? 0,
      balance: Number(bal.get(o.id ?? '')?.balance ?? 0),
      overdue: Number(bal.get(o.id ?? '')?.overdue_invoices ?? 0),
    }));
  }, [bid]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q));
  }, [data, search]);

  const totalOwed = (data ?? []).reduce((sum, c) => sum + c.balance, 0);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Clients" />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can view clients." />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Clients"
        subtitle={data ? `${data.length} client${data.length === 1 ? '' : 's'} · ${formatMoney(totalOwed, currency)} owing` : undefined}
        right={<HeaderIconButton icon="add" label="Add a client" onPress={() => router.push('/owner/new')} />}
        wide
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.link} />}
          ListHeaderComponent={
            <View style={{ gap: Spacing.sm }}>
              <ErrorText message={error} />
              <TextField label="Search clients" value={search} onChangeText={setSearch} placeholder="Name or email" autoCapitalize="none" />
            </View>
          }
          ListEmptyComponent={
            <EmptyState title="No clients yet" message="Tap + at the top to add a client, or add them when you add their horse." />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/owner/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{item.name}</AppText>
                <AppText variant="small" numberOfLines={1}>
                  {item.horseCount} horse{item.horseCount === 1 ? '' : 's'}
                  {item.phone ? ` · ${item.phone}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {item.balance > 0 ? <AppText variant="bodyStrong">{formatMoney(item.balance, currency)}</AppText> : null}
                {item.overdue > 0 ? (
                  <Badge label={`${item.overdue} overdue`} tone="gold" />
                ) : (
                  <Badge label={item.balance > 0 ? 'Owing' : 'Paid up'} tone="muted" />
                )}
              </View>
            </Pressable>
          )}
        />
      )}
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
