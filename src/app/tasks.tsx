import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, ChoiceList, EmptyState, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';
import { todayIso } from '@/lib/format';

type TaskType = 'feeding' | 'turnout' | 'treatment' | 'other';
const TYPE_LABELS: Record<TaskType, string> = { feeding: 'Feeding', turnout: 'Turnout', treatment: 'Treatment', other: 'Other' };

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { business, role } = useBusiness();
  const bid = business!.id;
  const canCreate = role === 'manager' || role === 'trainer';

  const { data, error, loading, refreshing, reload } = useScreenData(
    async () =>
      must(
        await supabase
          .from('daily_tasks')
          .select('id, title, task_type, done_at, horses(name)')
          .eq('business_id', bid)
          .eq('task_on', todayIso())
          .order('created_at'),
      ),
    [bid],
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = async (id: string, done: boolean) => {
    setActionError(null);
    setBusyId(id);
    const { error: e } = await supabase.from('daily_tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id);
    if (e) setActionError(e.message);
    await reload();
    setBusyId(null);
  };

  const remaining = (data ?? []).filter((t) => !t.done_at).length;

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="Today's tasks" subtitle={data ? `${remaining} of ${data.length} left to do` : undefined} showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.royalBlue} />}>
        <ErrorText message={error ?? actionError} />

        {canCreate ? <AddTaskCard bid={bid} onAdded={reload} /> : null}

        {loading && !data ? (
          <Loading />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nothing for today" message={canCreate ? 'Add a task above.' : 'Check back later.'} />
        ) : (
          <Card>
            {data.map((t, i) => (
              <Pressable
                key={t.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!t.done_at }}
                onPress={() => toggle(t.id, !t.done_at)}
                disabled={busyId === t.id}
                style={[styles.taskRow, i < data.length - 1 && styles.divider]}>
                <View style={[styles.checkbox, t.done_at && styles.checkboxDone]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={t.done_at ? { textDecorationLine: 'line-through', color: Colors.textMuted } : undefined}>{t.title}</AppText>
                  <AppText variant="small">
                    {TYPE_LABELS[t.task_type as TaskType] ?? t.task_type}
                    {t.horses ? ` · ${(t.horses as { name: string }).name}` : ''}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function AddTaskCard({ bid, onAdded }: { bid: string; onAdded: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!title.trim()) return setError('Describe the task.');
    setBusy(true);
    const { error: e } = await supabase.from('daily_tasks').insert({ business_id: bid, title: title.trim(), task_type: taskType, task_on: todayIso() });
    setBusy(false);
    if (e) return setError(e.message);
    setTitle('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a task</AppText>
      <TextField label="Task" value={title} onChangeText={setTitle} placeholder="Muck out Stall 3" />
      <ChoiceList
        label="Type"
        options={(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        value={taskType}
        onChange={setTaskType}
      />
      <ErrorText message={error} />
      <Button icon="add" title="Add" onPress={add} loading={busy} disabled={!title.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  checkbox: { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.royalBlue },
  checkboxDone: { backgroundColor: Colors.gold, borderColor: Colors.gold },
});
