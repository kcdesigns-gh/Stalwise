import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Badge,
  BlueHeader,
  EmptyState,
  ErrorText,
  HeaderIconButton,
  Loading,
  LogoMark,
  Button,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, TabBarClearance } from '@/constants/theme';
import { ageFrom, PURPOSE_LABELS, SEX_LABELS } from '@/lib/labels';
import { supabase, type HorsePurpose } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type Filter = 'all' | HorsePurpose;

export default function HorsesScreen() {
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    return must(
      await supabase
        .from('horses')
        .select('id, name, stock_number, current_purpose, sex, colour, breed, date_of_birth')
        .eq('business_id', bid)
        .is('archived_at', null)
        .order('name'),
    );
  }, [bid]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((h) => {
      if (filter !== 'all' && h.current_purpose !== filter) return false;
      if (!q) return true;
      return h.name.toLowerCase().includes(q) || (h.stock_number ?? '').toLowerCase().includes(q);
    });
  }, [data, search, filter]);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'training', label: 'Training' },
    { value: 'trading', label: 'Trading' },
    { value: 'broodstock', label: 'Broodstock' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title="Horses"
        subtitle={data ? `${data.length} on the yard` : undefined}
        right={isManager ? <HeaderIconButton icon="plus" label="Add a horse" onPress={() => router.push('/horse/new')} /> : null}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or stock number"
          placeholderTextColor={Colors.softBlue}
          accessibilityLabel="Search horses"
          style={styles.search}
          clearButtonMode="while-editing"
        />
        <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filter by purpose">
          {filters.map((f) => {
            const selected = f.value === filter;
            return (
              <Pressable
                key={f.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setFilter(f.value)}
                style={[styles.filter, selected && styles.filterSelected]}>
                <AppText
                  variant="small"
                  style={{ fontFamily: selected ? Fonts.bold : Fonts.semibold }}
                  color={selected ? Colors.deepBlue : Colors.surface}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </BlueHeader>

      {loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(h) => h.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}
          ListHeaderComponent={<ErrorText message={error} />}
          ListEmptyComponent={
            data && data.length === 0 ? (
              <EmptyState
                title="No horses yet"
                message={isManager ? 'Add your first horse to start tracking costs, training and stalls.' : 'Your Manager has not added any horses yet.'}
                action={isManager ? <Button title="Add a horse" icon="plus" onPress={() => router.push('/horse/new')} /> : null}
              />
            ) : (
              <EmptyState title="No matches" message="Try a different name or filter." />
            )
          }
          renderItem={({ item }) => {
            const facts = [item.sex ? SEX_LABELS[item.sex] : null, item.colour, ageFrom(item.date_of_birth)].filter(Boolean);
            return (
              <Link href={{ pathname: '/horse/[id]', params: { id: item.id } }} asChild>
                <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
                  <LogoMark name={item.name} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="small" numberOfLines={1}>
                      {[item.stock_number, ...facts].filter(Boolean).join(' · ') || 'No details yet'}
                    </AppText>
                  </View>
                  <Badge label={PURPOSE_LABELS[item.current_purpose]} tone={item.current_purpose === 'trading' ? 'gold' : 'muted'} />
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.midBlue,
    paddingHorizontal: Spacing.md,
    color: Colors.surface,
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  filters: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  filter: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.midBlue,
    justifyContent: 'center',
  },
  filterSelected: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  list: { padding: Spacing.lg, gap: 10, paddingBottom: TabBarClearance },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
  },
});
