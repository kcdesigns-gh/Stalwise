import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Card, ErrorText, Loading, StatTile } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatMoney, formatMoneyShort } from '@/lib/format';
import { PURPOSE_LABELS } from '@/lib/labels';
import { supabase, type HorsePurpose } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const { data, error, loading } = useScreenData(async () => {
    const [horses, stalls, assignments, profit, invoices] = await Promise.all([
      supabase.from('horses').select('id, name, current_purpose').eq('business_id', bid).is('archived_at', null),
      supabase.from('stalls').select('id, kind, capacity').eq('business_id', bid).eq('active', true),
      supabase.from('stall_assignments').select('stall_id').eq('business_id', bid).is('ended_on', null),
      supabase.from('horse_profitability').select('horse_id, total_income, total_cost, profit').eq('business_id', bid),
      supabase.from('invoices').select('id').eq('business_id', bid).in('status', ['sent', 'part_paid']),
    ]);

    const horseRows = must(horses) ?? [];
    const purposeCounts: Record<string, number> = {};
    for (const h of horseRows) purposeCounts[h.current_purpose] = (purposeCounts[h.current_purpose] ?? 0) + 1;

    const stallRows = must(stalls) ?? [];
    const trainingCapacity = stallRows.filter((s) => s.kind === 'training_stall').reduce((sum, s) => sum + s.capacity, 0);
    const occupied = (must(assignments) ?? []).length;

    const profitRows = must(profit) ?? [];
    const totalIncome = profitRows.reduce((sum, p) => sum + Number(p.total_income), 0);
    const totalCost = profitRows.reduce((sum, p) => sum + Number(p.total_cost), 0);
    const totalProfit = profitRows.reduce((sum, p) => sum + Number(p.profit), 0);

    const byId = new Map(horseRows.map((h) => [h.id, h.name]));
    const top = [...profitRows]
      .sort((a, b) => Number(b.profit) - Number(a.profit))
      .slice(0, 5)
      .map((p) => ({ horseId: p.horse_id ?? '', name: byId.get(p.horse_id ?? '') ?? 'Horse', profit: Number(p.profit) }));

    const openInvoices = must(invoices) ?? [];
    let unpaidBalance = 0;
    if (openInvoices.length) {
      const totals = must(await supabase.from('invoice_totals').select('balance').in('invoice_id', openInvoices.map((i) => i.id)));
      unpaidBalance = totals.reduce((sum, t) => sum + Number(t.balance ?? 0), 0);
    }

    return {
      horseCount: horseRows.length,
      purposeCounts,
      trainingCapacity,
      occupied,
      totalIncome,
      totalCost,
      totalProfit,
      top,
      unpaidBalance,
      openInvoiceCount: openInvoices.length,
    };
  }, [bid]);

  if (!isManager) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Dashboard" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager can see the dashboard." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="Dashboard" subtitle="All-time, across every horse" showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ErrorText message={error} />

        <View style={styles.grid}>
          <StatTile label="Income" value={data ? formatMoneyShort(data.totalIncome, currency) : '–'} />
          <StatTile label="Full cost" value={data ? formatMoneyShort(data.totalCost, currency) : '–'} />
          <StatTile label="Profit" value={data ? formatMoneyShort(data.totalProfit, currency) : '–'} />
        </View>

        <View style={styles.grid}>
          <StatTile label="Horses on yard" value={String(data?.horseCount ?? '–')} />
          <StatTile
            label="Stall occupancy"
            value={data && data.trainingCapacity > 0 ? `${data.occupied} of ${data.trainingCapacity}` : '–'}
          />
          <StatTile
            label="Unpaid invoices"
            value={data ? formatMoneyShort(data.unpaidBalance, currency) : '–'}
            note={data ? `${data.openInvoiceCount} open` : undefined}
          />
        </View>

        <Card>
          <AppText variant="heading">By purpose</AppText>
          {(['training', 'trading', 'broodstock'] as HorsePurpose[]).map((p, i, arr) => (
            <View key={p} style={[styles.row, i < arr.length - 1 && styles.divider]}>
              <AppText>{PURPOSE_LABELS[p]}</AppText>
              <AppText variant="bodyStrong">{data?.purposeCounts[p] ?? 0}</AppText>
            </View>
          ))}
        </Card>

        <Card>
          <AppText variant="heading">Most profitable horses</AppText>
          {!data || data.top.length === 0 ? <AppText muted>No data yet.</AppText> : null}
          {data?.top.map((t, i) => (
            <Pressable
              key={t.horseId}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/horse/[id]', params: { id: t.horseId } })}
              style={[styles.row, i < data.top.length - 1 && styles.divider]}>
              <AppText>{t.name}</AppText>
              <AppText variant="bodyStrong" color={t.profit >= 0 ? Colors.success : Colors.danger}>
                {formatMoney(t.profit, currency)}
              </AppText>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  grid: { flexDirection: 'row', gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
