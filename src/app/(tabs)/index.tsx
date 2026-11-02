import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  BlueHeader,
  Card,
  CostBreakdownBar,
  ErrorText,
  IconStat,
  IconStatGrid,
  LogoMark,
  StatTile,
} from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing, TabBarClearance } from '@/constants/theme';
import { formatDate, formatMoney, formatMoneyShort, todayIso } from '@/lib/format';
import { loadAvatarUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';

type DueItem = { id: string; horseId: string; horseName: string; careType: string; dueOn: string };
type TopHorse = { horseId: string; name: string; profit: number };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const CARE_LABELS: Record<string, string> = {
  deworming: 'Deworming',
  farrier: 'Farrier',
  dentist: 'Dentist',
  vaccination: 'Vaccination',
  other: 'Care',
};

export default function HomeScreen() {
  const { session } = useAuth();
  const { business, logoUrl, isManager, role, features } = useBusiness();
  const bid = business!.id;
  const currency = business!.currency_code;
  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const seesStalls = role === 'manager' || role === 'trainer';

  const { data, error, refreshing, reload } = useScreenData(async () => {
    const today = todayIso();
    const weekAhead = addDays(today, 7);

    const [horses, stalls, assignments, care, tasks] = await Promise.all([
      supabase.from('horses').select('id, name, current_owner_id', { count: 'exact' }).eq('business_id', bid).is('archived_at', null),
      seesStalls
        ? supabase.from('stalls').select('id, kind, capacity').eq('business_id', bid).eq('active', true)
        : Promise.resolve({ data: [], error: null }),
      seesStalls
        ? supabase.from('stall_assignments').select('stall_id').eq('business_id', bid).is('ended_on', null)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('care_schedules')
        .select('id, care_type, next_due_on, horse_id, horses(name)')
        .eq('business_id', bid)
        .eq('active', true)
        .lte('next_due_on', weekAhead)
        .order('next_due_on')
        .limit(6),
      supabase.from('daily_tasks').select('id, done_at').eq('business_id', bid).eq('task_on', today),
    ]);

    const stallRows = must(stalls) ?? [];
    const trainingStalls = stallRows.filter((s) => s.kind === 'training_stall');
    const occupied = new Set((must(assignments) ?? []).map((a) => a.stall_id));
    const usedStalls = trainingStalls.filter((s) => occupied.has(s.id)).length;

    let unpaid = 0;
    let unpaidCount = 0;
    let totalIncome = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let categoryBreakdown: { label: string; value: number }[] = [];
    let top: TopHorse[] = [];
    let avatars: Record<string, string> = {};

    if (isManager) {
      const horseRows = must(horses) ?? [];
      const [open, profit, costs, avatarMap] = await Promise.all([
        supabase.from('invoices').select('id').eq('business_id', bid).in('status', ['sent', 'part_paid']),
        supabase.from('horse_profitability').select('horse_id, total_income, total_cost, profit, feed_costs').eq('business_id', bid),
        supabase.from('cost_entries').select('amount, source, cost_categories(name)').eq('business_id', bid).neq('source', 'feed_rate'),
        loadAvatarUrls(bid).catch(() => ({}) as Record<string, string>),
      ]);
      avatars = avatarMap;

      const openInvoices = must(open) ?? [];
      if (openInvoices.length) {
        const totals = must(await supabase.from('invoice_totals').select('balance').in('invoice_id', openInvoices.map((i) => i.id)));
        unpaid = totals.reduce((sum, t) => sum + Number(t.balance ?? 0), 0);
        unpaidCount = openInvoices.length;
      }

      const profitRows = must(profit) ?? [];
      totalIncome = profitRows.reduce((sum, p) => sum + Number(p.total_income), 0);
      totalCost = profitRows.reduce((sum, p) => sum + Number(p.total_cost), 0);
      totalProfit = profitRows.reduce((sum, p) => sum + Number(p.profit), 0);
      const totalFeed = profitRows.reduce((sum, p) => sum + Number(p.feed_costs ?? 0), 0);

      const byId = new Map(horseRows.map((h) => [h.id, h.name]));
      top = [...profitRows]
        .sort((a, b) => Number(b.profit) - Number(a.profit))
        .slice(0, 3)
        .map((p) => ({ horseId: p.horse_id ?? '', name: byId.get(p.horse_id ?? '') ?? 'Horse', profit: Number(p.profit) }));

      const byCategory = new Map<string, number>();
      for (const c of must(costs) ?? []) {
        const name = (c.cost_categories as { name: string } | null)?.name ?? 'Other';
        byCategory.set(name, (byCategory.get(name) ?? 0) + Number(c.amount));
      }
      if (totalFeed > 0) byCategory.set('Feed (flat rate)', (byCategory.get('Feed (flat rate)') ?? 0) + totalFeed);
      categoryBreakdown = [...byCategory.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }

    const due: DueItem[] = (must(care) ?? []).map((c) => ({
      id: c.id,
      horseId: c.horse_id,
      horseName: (c.horses as { name: string } | null)?.name ?? 'Horse',
      careType: c.care_type,
      dueOn: c.next_due_on,
    }));

    const taskRows = must(tasks) ?? [];
    return {
      horseCount: horses.count ?? 0,
      trainingStalls: trainingStalls.length,
      usedStalls,
      unpaid,
      unpaidCount,
      totalIncome,
      totalCost,
      totalProfit,
      categoryBreakdown,
      top,
      avatars,
      due,
      tasksTotal: taskRows.length,
      tasksDone: taskRows.filter((t) => t.done_at).length,
      today,
    };
  }, [bid, isManager, seesStalls]);

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader
        title={business!.name}
        subtitle={firstName ? `${greeting()}, ${firstName}` : greeting()}
        logo={<LogoMark name={business!.name} uri={logoUrl} />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}>
        <ErrorText message={error} />

        {isManager ? (
          <>
            <Card gold>
              <View style={styles.heroRow}>
                <AppText variant="label">Total profit</AppText>
                <AppText variant="title" color={data && data.totalProfit < 0 ? Colors.danger : Colors.success} style={styles.heroFigure}>
                  {data ? formatMoney(data.totalProfit, currency) : '–'}
                </AppText>
              </View>
              <IconStatGrid>
                <IconStat icon="trend" tone="gold" label="Income" value={data ? formatMoneyShort(data.totalIncome, currency) : '–'} />
                <IconStat icon="tag" tone="blue" label="Full cost" value={data ? formatMoneyShort(data.totalCost, currency) : '–'} />
                <IconStat icon="horses" tone="blue" label="Horses on yard" value={String(data?.horseCount ?? '–')} />
                {seesStalls ? (
                  <IconStat icon="stalls" tone="blue" label="Stall occupancy" value={data ? `${data.usedStalls} of ${data.trainingStalls}` : '–'} />
                ) : null}
                <IconStat
                  icon="invoices"
                  tone="gold"
                  label="Unpaid invoices"
                  value={data ? formatMoneyShort(data.unpaid, currency) : '–'}
                />
                {features.task_board ? (
                  <IconStat
                    icon="more"
                    tone="green"
                    label="Today's tasks"
                    value={data ? `${data.tasksDone} of ${data.tasksTotal}` : '–'}
                    onPress={() => router.push('/tasks')}
                  />
                ) : null}
              </IconStatGrid>
            </Card>

            {data && data.categoryBreakdown.length > 0 ? (
              <Card>
                <AppText variant="heading" accessibilityRole="header">
                  Cost breakdown
                </AppText>
                <CostBreakdownBar items={data.categoryBreakdown} formatValue={(v) => formatMoney(v, currency)} />
              </Card>
            ) : null}

            {data && data.top.length > 0 ? (
              <Card>
                <AppText variant="heading" accessibilityRole="header">
                  Most profitable horses
                </AppText>
                {data.top.map((t, i) => (
                  <Pressable
                    key={t.horseId}
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/horse/[id]', params: { id: t.horseId } })}
                    style={[styles.horseRow, i < data.top.length - 1 && styles.divider]}>
                    <LogoMark name={t.name} uri={data.avatars[t.horseId]} size={36} />
                    <AppText style={{ flex: 1 }}>{t.name}</AppText>
                    <AppText variant="bodyStrong" color={t.profit >= 0 ? Colors.success : Colors.danger}>
                      {formatMoney(t.profit, currency)}
                    </AppText>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </>
        ) : (
          <View style={styles.grid}>
            <StatTile label="Horses on yard" value={String(data?.horseCount ?? '–')} />
            {seesStalls ? (
              <StatTile
                label="Stall occupancy"
                value={data ? `${data.usedStalls} of ${data.trainingStalls}` : '–'}
                note={data && data.trainingStalls === 0 ? 'No stalls set up yet' : undefined}
              />
            ) : null}
            {features.task_board ? (
              <Pressable accessibilityRole="link" onPress={() => router.push('/tasks')} style={{ flex: 1 }}>
                <StatTile label="Today's tasks" value={data ? `${data.tasksDone} of ${data.tasksTotal}` : '–'} note="done" />
              </Pressable>
            ) : null}
          </View>
        )}

        {features.health_reminders ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Due in the next 7 days
            </AppText>
            {data && data.due.length === 0 ? <AppText muted>Nothing due. All up to date.</AppText> : null}
            {data?.due.map((item, i) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/horse/[id]', params: { id: item.horseId } })}
                  style={[styles.dueRow, i < data.due.length - 1 ? styles.divider : null]}>
                  <View
                    style={[styles.dot, { backgroundColor: item.dueOn <= data.today ? Colors.mutedGold : Colors.royalBlue }]}
                  />
                  <AppText style={{ flex: 1 }}>
                    {CARE_LABELS[item.careType] ?? 'Care'} · {item.horseName}
                  </AppText>
                  <AppText variant="small">{item.dueOn <= data.today ? 'Due now' : formatDate(item.dueOn)}</AppText>
                </Pressable>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: TabBarClearance },
  grid: { flexDirection: 'row', gap: 10 },
  heroRow: { gap: 2 },
  heroFigure: { fontSize: 34 },
  horseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, minHeight: 44 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
