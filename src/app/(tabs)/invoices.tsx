import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Badge, BlueHeader, EmptyState, ErrorText, Loading } from '@/components/ui';
import { Colors, Radius, Spacing, TabBarClearance } from '@/constants/theme';
import { formatDate, formatMoney } from '@/lib/format';
import { INVOICE_STATUS_LABELS } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function InvoicesScreen() {
  const { business } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const { data, error, loading, refreshing, reload } = useScreenData(async () => {
    const invoices = must(
      await supabase
        .from('invoices')
        .select('id, invoice_number, status, issued_on, due_on, created_at, owners(name)')
        .eq('business_id', bid)
        .order('created_at', { ascending: false })
        .limit(100),
    );
    const totals = invoices.length
      ? must(await supabase.from('invoice_totals').select('invoice_id, total, balance').in('invoice_id', invoices.map((i) => i.id)))
      : [];
    const byId = new Map(totals.map((t) => [t.invoice_id, t]));
    return invoices.map((i) => ({
      ...i,
      ownerName: (i.owners as { name: string } | null)?.name ?? '—',
      total: Number(byId.get(i.id)?.total ?? 0),
      balance: Number(byId.get(i.id)?.balance ?? 0),
    }));
  }, [bid]);

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="Invoices" subtitle={data ? `${data.length} invoice${data.length === 1 ? '' : 's'}` : undefined} />
      {loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}
          ListHeaderComponent={<ErrorText message={error} />}
          ListEmptyComponent={
            <EmptyState
              title="No invoices yet"
              message="Creating and sharing invoices is the next part being built. Monthly livery and training invoices will appear here."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{item.invoice_number ?? 'Draft'}</AppText>
                <AppText variant="small" numberOfLines={1}>
                  {item.ownerName}
                  {item.due_on ? ` · due ${formatDate(item.due_on)}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <AppText variant="bodyStrong">{formatMoney(item.total, currency)}</AppText>
                <Badge
                  label={INVOICE_STATUS_LABELS[item.status] ?? item.status}
                  tone={item.status === 'paid' ? 'blue' : item.status === 'part_paid' ? 'gold' : 'muted'}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    minHeight: 68,
  },
});
