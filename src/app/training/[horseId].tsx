import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BlueHeader, Button, Card, DetailRow, ErrorText, Loading, Segmented, TextField } from '@/components/ui';
import { ContentMaxWidth, Colors, Spacing } from '@/constants/theme';
import { formatDate, parseDayMonthYear, toDayMonthYear, todayIso } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { must, useScreenData } from '@/lib/use-query';
import { useBusiness } from '@/providers/business';

type TabView = 'sessions' | 'notes' | 'shows';

export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { business, role } = useBusiness();
  const bid = business!.id;
  const canLog = role === 'manager' || role === 'trainer';
  const [view, setView] = useState<TabView>('sessions');

  const { data, error, loading, reload } = useScreenData(async () => {
    const [horse, sessions, notes, shows] = await Promise.all([
      supabase.from('horses').select('id, name').eq('id', horseId).single(),
      supabase.from('training_sessions').select('id, session_on, session_type, duration_minutes, notes').eq('horse_id', horseId).order('session_on', { ascending: false }).limit(15),
      supabase.from('progress_notes').select('id, week_starting, note, milestone').eq('horse_id', horseId).order('week_starting', { ascending: false }).limit(15),
      supabase.from('show_entries').select('id, show_name, show_on, class_name, rider, finish_position, result').eq('horse_id', horseId).order('show_on', { ascending: false }).limit(15),
    ]);
    return { horse: must(horse), sessions: must(sessions) ?? [], notes: must(notes) ?? [], shows: must(shows) ?? [] };
  }, [horseId]);

  if (!canLog) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Training" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message="Only the Manager and Trainers see training records." />
        </View>
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <BlueHeader title="Training" showBack />
        <View style={{ padding: Spacing.lg }}>
          <ErrorText message={error ?? 'This horse could not be found.'} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Training" subtitle={data.horse.name} showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <ErrorText message={error} />
        <Segmented
          label="Show"
          options={[
            { value: 'sessions', label: 'Sessions' },
            { value: 'notes', label: 'Progress notes' },
            { value: 'shows', label: 'Shows' },
          ]}
          value={view}
          onChange={setView}
        />

        {view === 'sessions' ? (
          <>
            <AddSessionCard bid={bid} horseId={horseId} onAdded={reload} />
            <Card>
              <AppText variant="heading">Recent sessions</AppText>
              {data.sessions.length === 0 ? <AppText muted>None logged yet.</AppText> : null}
              {data.sessions.map((s, i) => (
                <DetailRow
                  key={s.id}
                  label={`${s.session_type}${s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}`}
                  value={formatDate(s.session_on)}
                  last={i === data.sessions.length - 1}
                />
              ))}
            </Card>
          </>
        ) : null}

        {view === 'notes' ? (
          <>
            <AddNoteCard bid={bid} horseId={horseId} onAdded={reload} />
            <Card>
              <AppText variant="heading">Progress notes</AppText>
              {data.notes.length === 0 ? <AppText muted>None yet.</AppText> : null}
              {data.notes.map((n, i) => (
                <View key={n.id} style={[styles.noteRow, i < data.notes.length - 1 && styles.divider]}>
                  <AppText variant="small">Week of {formatDate(n.week_starting)}{n.milestone ? ` · ${n.milestone}` : ''}</AppText>
                  <AppText>{n.note}</AppText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {view === 'shows' ? (
          <>
            <AddShowCard bid={bid} horseId={horseId} onAdded={reload} />
            <Card>
              <AppText variant="heading">Shows</AppText>
              {data.shows.length === 0 ? <AppText muted>None yet.</AppText> : null}
              {data.shows.map((s, i) => (
                <View key={s.id} style={[styles.noteRow, i < data.shows.length - 1 && styles.divider]}>
                  <AppText variant="bodyStrong">{s.show_name}{s.class_name ? ` · ${s.class_name}` : ''}</AppText>
                  <AppText variant="small">
                    {formatDate(s.show_on)}{s.rider ? ` · ${s.rider}` : ''}{s.finish_position ? ` · ${s.finish_position} place` : ''}{s.result ? ` · ${s.result}` : ''}
                  </AppText>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddSessionCard({ bid, horseId, onAdded }: { bid: string; horseId: string; onAdded: () => Promise<void> }) {
  const [sessionType, setSessionType] = useState('');
  const [date, setDate] = useState(toDayMonthYear(todayIso()));
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!sessionType.trim()) return setError('What kind of session, for example Flatwork or Jumping.');
    const day = parseDayMonthYear(date);
    if (!day) return setError('Enter the date as day/month/year.');
    setBusy(true);
    const { error: e } = await supabase.from('training_sessions').insert({
      business_id: bid,
      horse_id: horseId,
      session_on: day,
      session_type: sessionType.trim(),
      duration_minutes: duration.trim() ? Number(duration) : null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setSessionType('');
    setDuration('');
    setNotes('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Log a session</AppText>
      <TextField label="Session type" value={sessionType} onChangeText={setSessionType} placeholder="Flatwork" />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Minutes" value={duration} onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
      </View>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <ErrorText message={error} />
      <Button icon="add" title="Log session" onPress={add} loading={busy} />
    </Card>
  );
}

function AddNoteCard({ bid, horseId, onAdded }: { bid: string; horseId: string; onAdded: () => Promise<void> }) {
  const [weekStarting, setWeekStarting] = useState(toDayMonthYear(todayIso()));
  const [note, setNote] = useState('');
  const [milestone, setMilestone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const week = parseDayMonthYear(weekStarting);
    if (!week) return setError('Enter the week starting date as day/month/year.');
    if (!note.trim()) return setError('Write the progress note.');
    setBusy(true);
    const { error: e } = await supabase.from('progress_notes').insert({
      business_id: bid,
      horse_id: horseId,
      week_starting: week,
      note: note.trim(),
      milestone: milestone.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setNote('');
    setMilestone('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a progress note</AppText>
      <TextField label="Week starting" value={weekStarting} onChangeText={setWeekStarting} keyboardType="numbers-and-punctuation" />
      <TextField label="Note" value={note} onChangeText={setNote} multiline />
      <TextField label="Milestone (optional)" value={milestone} onChangeText={setMilestone} placeholder="First clear round" />
      <ErrorText message={error} />
      <Button icon="add" title="Add note" onPress={add} loading={busy} />
    </Card>
  );
}

function AddShowCard({ bid, horseId, onAdded }: { bid: string; horseId: string; onAdded: () => Promise<void> }) {
  const [showName, setShowName] = useState('');
  const [date, setDate] = useState(toDayMonthYear(todayIso()));
  const [className, setClassName] = useState('');
  const [rider, setRider] = useState('');
  const [position, setPosition] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!showName.trim()) return setError('Enter the show name.');
    const day = parseDayMonthYear(date);
    if (!day) return setError('Enter the date as day/month/year.');
    setBusy(true);
    const { error: e } = await supabase.from('show_entries').insert({
      business_id: bid,
      horse_id: horseId,
      show_name: showName.trim(),
      show_on: day,
      class_name: className.trim() || null,
      rider: rider.trim() || null,
      finish_position: position.trim() ? Number(position) : null,
      result: result.trim() || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setShowName('');
    setClassName('');
    setRider('');
    setPosition('');
    setResult('');
    await onAdded();
  };

  return (
    <Card gold>
      <AppText variant="heading">Add a show result</AppText>
      <TextField label="Show name" value={showName} onChangeText={setShowName} />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Date" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Class" value={className} onChangeText={setClassName} />
        </View>
      </View>
      <TextField label="Rider" value={rider} onChangeText={setRider} />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Placing" value={position} onChangeText={(t) => setPosition(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Result" value={result} onChangeText={setResult} placeholder="Clear round" />
        </View>
      </View>
      <ErrorText message={error} />
      <Button icon="add" title="Add result" onPress={add} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  noteRow: { paddingVertical: 10, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
});
