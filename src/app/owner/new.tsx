import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueHeader, Button, Card, ErrorText, TextField, ToggleRow } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useBusiness } from '@/providers/business';

export default function NewOwnerScreen() {
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();
  const bid = business!.id;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter the owner’s name.');
    setBusy(true);
    const { data, error: e } = await supabase
      .from('owners')
      .insert({
        business_id: bid,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        updates_consent: consent,
        updates_consent_at: consent ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    setBusy(false);
    if (e || !data) return setError(e?.message ?? 'Could not save the owner.');
    router.replace({ pathname: '/owner/[id]', params: { id: data.id } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Add an owner" showBack />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Card gold>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <ToggleRow label="Agreed to receive WhatsApp/email updates" value={consent} onChange={setConsent} last />
        </Card>
        <ErrorText message={error} />
        <Button title="Save owner" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
