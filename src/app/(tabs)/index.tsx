import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BlueHeader, Card, ErrorText, LogoMark, StatTile } from '@/components/ui';
import { Colors, ContentMaxWidth, Spacing, TabBarClearance } from '@/constants/theme';
import { formatDate, formatMoneyShort, todayIso } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';

type DueItem = { id: string; horseId: string; horseName: string; careType: string; dueOn: string };

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
  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const seesStalls = role === 'manager' || role === 'trainer';

  const { data, error, refreshing, reload } = useScreenData(async () => {
    const today = todayIso();
    const weekAhead = addDays(today, 7);

    const [horses, stalls, assignments, care, tasks] = await Promise.all([
      supabase.from('horses').select('id, current_owner_id', { count: 'exact' }).eq('business_id', bid).is('archived_at', null),
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
    if (isManager) {
      const open = must(
        await supabase.from('invoices').select('id').eq('business_id', bid).in('status', ['sent', 'part_paid']),
      );
      if (open.length) {
        const totals = must(
          await supabase.from('invoice_totals').select('balance').in('invoice_id', open.map((i) => i.id)),
        );
        unpaid = totals.reduce((sum, t) => sum + Number(t.balance ?? 0), 0);
        unpaidCount = open.length;
      }
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

        <View style={styles.grid}>
          <StatTile label="Horses on yard" value={String(data?.horseCount ?? '–')} />
          {seesStalls ? (
            <StatTile
              label="Stall occupancy"
              value={data ? `${data.usedStalls} of ${data.trainingStalls}` : '–'}
              note={data && data.trainingStalls === 0 ? 'No stalls set up yet' : undefined}
            />
          ) : null}
        </View>

        <View style={styles.grid}>
          {isManager ? (
            <StatTile
              label="Unpaid invoices"
              value={data ? formatMoneyShort(data.unpaid, business!.currency_code) : '–'}
              note={data ? `${data.unpaidCount} invoice${data.unpaidCount === 1 ? '' : 's'}` : undefined}
            />
          ) : null}
          {features.task_board ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/tasks')} style={{ flex: 1 }}>
              <StatTile
                label="Today's tasks"
                value={data ? `${data.tasksDone} of ${data.tasksTotal}` : '–'}
                note="done"
              />
            </Pressable>
          ) : null}
        </View>

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
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, minHeight: 44 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
