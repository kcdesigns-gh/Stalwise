import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppText, Button, Card, ErrorText, TextField } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError('Your new password needs at least 8 characters.');
    if (password !== password2) return setError('Those passwords don’t match.');
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(e.message);
    finishRecovery();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Icon name="crown" color={Colors.gold} size={34} />
          <Text style={styles.wordmark} accessibilityRole="header">
            Stal<Text style={{ color: Colors.gold }}>wise</Text>
          </Text>
        </View>

        <Card gold style={styles.card}>
          <AppText variant="heading">Set a new password</AppText>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            hint="At least 8 characters."
          />
          <TextField label="Confirm new password" value={password2} onChangeText={setPassword2} secureTextEntry />
          <ErrorText message={error} />
          <Button title="Save new password" onPress={save} loading={busy} />
          <Button kind="secondary" title="Cancel" onPress={signOut} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.deepBlue, paddingHorizontal: Spacing.xl, gap: Spacing.xxl },
  brand: { alignItems: 'center', gap: Spacing.sm },
  wordmark: { fontFamily: Fonts.extrabold, fontSize: 36, color: Colors.surface, letterSpacing: 0.3 },
  card: { gap: Spacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
