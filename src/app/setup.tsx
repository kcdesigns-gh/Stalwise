import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusinessForm, EMPTY_BUSINESS } from '@/components/business-form';
import { Button, Card, ErrorText, Segmented, TextField } from '@/components/ui';
import { Colors, ContentMaxWidth, Fonts, Spacing } from '@/constants/theme';
import { createBusiness } from '@/lib/business';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { refresh } = useBusiness();
  const { signOut } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const join = async () => {
    setJoinError(null);
    if (!code.trim()) return setJoinError('Enter the invite code your Manager gave you.');
    setJoining(true);
    const { data, error } = await supabase.rpc('join_with_invite', { invite_code: code.trim() });
    setJoining(false);
    if (error) return setJoinError(error.message);
    // A wrong, used or expired code comes back as a result, not an error.
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) return setJoinError(result?.error ?? 'That code did not work. Check it and try again.');
    await refresh();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.wordmark}>
            Stal<Text style={{ color: Colors.gold }}>wise</Text>
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {mode === 'create' ? 'Set up your business' : 'Join your business'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'create'
              ? 'Your name and logo appear on your screens and invoices.'
              : 'Enter the code your Manager shared with you.'}
          </Text>
        </View>

        <View style={styles.body}>
          <Segmented
            label="I want to"
            options={[
              { value: 'create', label: 'Create a business' },
              { value: 'join', label: 'Join with a code' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'create' ? (
            <BusinessForm
              initial={EMPTY_BUSINESS}
              submitLabel="Create my business"
              onSubmit={async (values, logo) => {
                await createBusiness(values, logo);
                await refresh();
              }}
            />
          ) : (
            <Card gold>
              <TextField
                label="Invite code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <ErrorText message={joinError} />
              <Button title="Join" onPress={join} loading={joining} disabled={!code.trim()} />
            </Card>
          )}

          <Button kind="secondary" title="Sign out" onPress={signOut} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.deepBlue,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
    gap: 6,
  },
  wordmark: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.onChrome, marginBottom: 8 },
  title: { fontFamily: Fonts.extrabold, fontSize: 20, color: Colors.onChrome },
  subtitle: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.softBlue },
  body: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
});
