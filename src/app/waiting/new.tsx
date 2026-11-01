import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueHeader, Button, Card, ErrorText, TextField } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useBusiness } from '@/providers/business';

export default function NewWaitingScreen() {
  const insets = useSafeAreaInsets();
  const { business, isManager } = useBusiness();
  const bid = business!.id;

  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [about, setAbout] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isManager) {
    return (
      <>
        <BlueHeader title="Waiting list" showBack />
        <ErrorText message="Only the Manager can change the waiting list." />
      </>
    );
  }

  const save = async () => {
    setError(null);
    const horses = Number(count);
    if (!name.trim()) return setError('Enter the client’s name.');
    if (!Number.isInteger(horses) || horses < 1) return setError('Enter how many horses, for example 1.');
    setBusy(true);
    const { error: e } = await supabase.from('waiting_list').insert({
      business_id: bid,
      contact_name: name.trim(),
      horse_count: horses,
      horse_description: about.trim() || null,
      notes: notes.trim() || null,
    });
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Add to waiting list" showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label="Client name" value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField label="How many horses?" value={count} onChangeText={(t) => setCount(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          <TextField label="About the horse (optional)" value={about} onChangeText={setAbout} placeholder="Grey mare, 6 years, jumping" />
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline hint="Phone number, when they want to start…" />
        </Card>
        <ErrorText message={error} />
        <Button title="Add to waiting list" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
