import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Card, CostBreakdownBar, ErrorText, IconStat, IconStatGrid, Loading, LogoMark } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing } from '@/constants/theme';
import { formatMoney, formatMoneyShort } from '@/lib/format';
import { PURPOSE_LABELS } from '@/lib/labels';
import { loadAvatarUrls } from '@/lib/photos';
import { supabase, type HorsePurpose } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;

  const { data, error, loading } = useScreenData(async () => {
    const [horses, stalls, assignments, profit, invoices, costs, avatars] = await Promise.all([
      supabase.from('horses').select('id, name, current_purpose').eq('business_id', bid).is('archived_at', null),
      supabase.from('stalls').select('id, kind, capacity').eq('business_id', bid).eq('active', true),
      supabase.from('stall_assignments').select('stall_id').eq('business_id', bid).is('ended_on', null),
      supabase.from('horse_profitability').select('horse_id, total_income, total_cost, profit, feed_costs').eq('business_id', bid),
      supabase.from('invoices').select('id').eq('business_id', bid).in('status', ['sent', 'part_paid']),
      supabase.from('cost_entries').select('amount, source, cost_categories(name)').eq('business_id', bid).neq('source', 'feed_rate'),
      loadAvatarUrls(bid).catch(() => ({}) as Record<string, string>),
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
    const totalFeed = profitRows.reduce((sum, p) => sum + Number(p.feed_costs ?? 0), 0);

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

    const byCategory = new Map<string, number>();
    for (const c of must(costs) ?? []) {
      const name = (c.cost_categories as { name: string } | null)?.name ?? 'Other';
      byCategory.set(name, (byCategory.get(name) ?? 0) + Number(c.amount));
    }
    if (totalFeed > 0) byCategory.set('Feed (flat rate)', (byCategory.get('Feed (flat rate)') ?? 0) + totalFeed);
    const categoryBreakdown = [...byCategory.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

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
      categoryBreakdown,
      avatars,
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

        <Card gold>
          <IconStatGrid>
            <IconStat icon="money" tone="green" label="Total profit" value={data ? formatMoneyShort(data.totalProfit, currency) : '–'} />
            <IconStat icon="trend" tone="gold" label="Income" value={data ? formatMoneyShort(data.totalIncome, currency) : '–'} />
            <IconStat icon="horses" tone="blue" label="Horses on yard" value={String(data?.horseCount ?? '–')} />
            <IconStat
              icon="stalls"
              tone="blue"
              label="Stall occupancy"
              value={data && data.trainingCapacity > 0 ? `${data.occupied} of ${data.trainingCapacity}` : '–'}
            />
            <IconStat
              icon="invoices"
              tone="gold"
              label="Unpaid invoices"
              value={data ? formatMoneyShort(data.unpaidBalance, currency) : '–'}
            />
            <IconStat icon="tag" tone="blue" label="Full cost" value={data ? formatMoneyShort(data.totalCost, currency) : '–'} />
          </IconStatGrid>
        </Card>

        <Card>
          <AppText variant="heading">Cost breakdown</AppText>
          {data ? <CostBreakdownBar items={data.categoryBreakdown} formatValue={(v) => formatMoney(v, currency)} /> : null}
        </Card>

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
              style={[styles.row, styles.horseRow, i < data.top.length - 1 && styles.divider]}>
              <LogoMark name={t.name} uri={data.avatars[t.horseId]} size={36} />
              <AppText style={{ flex: 1 }}>{t.name}</AppText>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  horseRow: { gap: Spacing.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
