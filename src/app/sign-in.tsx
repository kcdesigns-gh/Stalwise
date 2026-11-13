import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppText, Button, Card, ErrorText, TextField } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { recoveryRedirectUrl } from '@/lib/auth-recovery';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return setError('Enter a valid email address.');

    if (mode === 'forgot') {
      setBusy(true);
      const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: recoveryRedirectUrl() });
      setBusy(false);
      if (e) return setError(friendlyAuthError(e.message));
      setNotice('If that email has an account, we’ve sent a link to reset the password. Open it on this device.');
      return;
    }

    if (password.length < 8) return setError('Your password needs at least 8 characters.');
    if (mode === 'sign-up' && !fullName.trim()) return setError('Enter your name.');

    setBusy(true);
    if (mode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError) setError(friendlyAuthError(signInError.message));
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) {
        setError(friendlyAuthError(signUpError.message));
      } else if (!data.session) {
        setNotice('Account created. Open the confirmation email we sent you, then come back and sign in.');
        setMode('sign-in');
      }
    }
    setBusy(false);
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
          <Text style={styles.tagline}>Horse business management</Text>
        </View>

        <Card gold style={styles.card}>
          <AppText variant="heading">{mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create your account' : 'Reset your password'}</AppText>
          {mode === 'sign-up' ? (
            <TextField
              label="Your name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              textContentType="name"
            />
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {mode !== 'forgot' ? (
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
              hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
            />
          ) : null}
          <ErrorText message={error} />
          {notice ? <AppText color={Colors.success}>{notice}</AppText> : null}
          <Button
            title={mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
            onPress={submit}
            loading={busy}
          />
          {mode === 'sign-in' ? (
            <Button
              kind="secondary"
              title="Forgot your password?"
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode('forgot');
              }}
            />
          ) : null}
          {mode === 'sign-in' || mode === 'sign-up' ? (
            <Button
              kind="secondary"
              title={mode === 'sign-in' ? 'New here? Create an account' : 'I already have an account'}
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              }}
            />
          ) : (
            <Button
              kind="secondary"
              title="Back to sign in"
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode('sign-in');
              }}
            />
          )}
          <Button kind="secondary" title="Privacy policy" onPress={() => router.push('/privacy')} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match. Please try again.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for our email.';
  if (m.includes('already registered')) return 'There is already an account with this email. Sign in instead.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a few minutes and try again.';
  return message;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.deepBlue,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  brand: { alignItems: 'center', gap: Spacing.sm },
  wordmark: { fontFamily: Fonts.extrabold, fontSize: 36, color: Colors.onChrome, letterSpacing: 0.3 },
  tagline: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.softBlue },
  card: { gap: Spacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
