import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText, BlueHeader, Button, Card, DetailRow, ErrorText, LogoMark, Segmented, TextField, ToggleRow } from '@/components/ui';
import { setThemePreference, themeNeedsRestart, useThemePreference, type ThemePreference } from '@/lib/theme-mode';
import { Colors, ContentMaxWidth, Fonts, Spacing, TabBarClearance } from '@/constants/theme';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { ROLE_LABELS } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useBusiness, type Feature } from '@/providers/business';

const FEATURE_LABELS: { key: Feature; label: string }[] = [
  { key: 'breeding', label: 'Breeding (stud)' },
  { key: 'training', label: 'Training logs' },
  { key: 'trading', label: 'Trading' },
  { key: 'health_reminders', label: 'Health reminders' },
  { key: 'task_board', label: 'Groom task board' },
];

export default function MoreScreen() {
  const { session, signOut } = useAuth();
  const { business, role, features, logoUrl, isManager, refresh } = useBusiness();
  const [saving, setSaving] = useState<Feature | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (feature: Feature, enabled: boolean) => {
    setError(null);
    setSaving(feature);
    const { error: e } = await supabase
      .from('business_features')
      .update({ enabled })
      .eq('business_id', business!.id)
      .eq('feature', feature);
    if (e) setError(e.message);
    await refresh();
    setSaving(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="More" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card gold>
          <View style={styles.bizRow}>
            <LogoMark name={business!.name} uri={logoUrl} size={56} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{business!.name}</AppText>
              <AppText variant="small">
                {business!.currency_code} · {business!.tax_name} {Number(business!.default_tax_rate)}%
              </AppText>
            </View>
          </View>
          {isManager ? (
            <Button kind="secondary" title="Edit business profile" onPress={() => router.push('/business')} />
          ) : null}
          {isManager ? <Button kind="secondary" title="Staff" onPress={() => router.push('/staff')} /> : null}
          {isManager ? <Button kind="secondary" title="Owners & clients" onPress={() => router.push('/owners')} /> : null}
        </Card>

        {features.task_board ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Tasks
            </AppText>
            <Button kind="secondary" title="Today's tasks" onPress={() => router.push('/tasks')} />
          </Card>
        ) : null}

        {isManager ? (
          <Card>
            <AppText variant="heading" accessibilityRole="header">
              Costs
            </AppText>
            <AppText variant="small">
              Set what it costs to feed a horse each day and every horse is charged automatically. Keep your medicine and supplement prices in the product list.
            </AppText>
            <Button title="Daily feed rate" onPress={() => router.push('/feed-rate')} />
            <Button kind="secondary" title="Products & prices" onPress={() => router.push('/products')} />
            <Button kind="secondary" title="Shared costs (rent, wages)" onPress={() => router.push('/shared-costs')} />
          </Card>
        ) : null}

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Features
          </AppText>
          {!isManager ? <AppText variant="small">Only the Manager can switch features on or off.</AppText> : null}
          {FEATURE_LABELS.map((f, i) => (
            <ToggleRow
              key={f.key}
              label={f.label}
              value={features[f.key]}
              onChange={(next) => toggle(f.key, next)}
              disabled={!isManager || saving !== null}
              last={i === FEATURE_LABELS.length - 1}
            />
          ))}
          <ErrorText message={error} />
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Your account
          </AppText>
          <DetailRow label="Signed in as" value={session?.user.email ?? '—'} />
          <DetailRow label="Role" value={role ? ROLE_LABELS[role] : '—'} last />
          <Button kind="secondary" title="Sign out" onPress={signOut} />
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Help and privacy
          </AppText>
          <Button kind="secondary" title="Privacy policy" onPress={() => router.push('/privacy')} />
          <Button
            kind="secondary"
            title="Contact support"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        </Card>

        <AppearanceCard />

        <DeleteAccountCard />

        <Text style={styles.footer}>
          Powered by Stal<Text style={{ color: Colors.mutedGold }}>wise</Text> · version {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>
    </View>
  );
}

// Light or dark look. Saved on this device only, so each person chooses their own.
function AppearanceCard() {
  const preference = useThemePreference();
  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        Appearance
      </AppText>
      <Segmented<ThemePreference>
        label="Look"
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'Match device' },
        ]}
        value={preference}
        onChange={setThemePreference}
      />
      <AppText variant="small">
        {themeNeedsRestart
          ? 'Close and reopen the app to see the change. Saved on this device only.'
          : 'Dark is easier on the eyes indoors and at night. Switch to Light if the screen is hard to read in bright sun. Saved on this device only.'}
      </AppText>
    </Card>
  );
}

function DeleteAccountCard() {
  const { signOut } = useAuth();
  const { isManager, business } = useBusiness();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A Manager's account can't be removed without deciding what happens to the
  // business, so for them deleting the account deletes the business too.
  const needsTyping = isManager;
  const ready = !needsTyping || typed.trim() === 'DELETE';

  const deleteAccount = async () => {
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    if (!ready) return;
    setBusy(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: { deleteBusiness: isManager },
    });
    if (invokeError) {
      let message = invokeError.message;
      const context = (invokeError as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = (await context.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // Response body wasn't JSON; fall back to the generic message above.
        }
      }
      setError(message);
      setBusy(false);
      setConfirming(false);
      setTyped('');
      return;
    }
    await signOut();
  };

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header" color={Colors.danger}>
        Delete account
      </AppText>
      {isManager ? (
        <AppText variant="small">
          You are the Manager of {business?.name ?? 'this business'}. Deleting your account permanently deletes the
          whole business too: every horse, photo, cost, invoice and your logo, for everyone on the team. This cannot
          be undone.
        </AppText>
      ) : (
        <AppText variant="small">
          Permanently deletes your login. Horses, costs and invoices you created stay with the business &mdash; only
          your own sign-in goes.
        </AppText>
      )}
      {confirming && needsTyping ? (
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      ) : null}
      <ErrorText message={error} />
      <Button
        kind="secondary"
        title={
          !confirming
            ? 'Delete my account'
            : isManager
              ? 'Permanently delete account and business'
              : 'Tap again to permanently delete'
        }
        onPress={deleteAccount}
        loading={busy}
        disabled={confirming && !ready}
      />
      {confirming ? (
        <Button
          kind="secondary"
          title="Cancel"
          onPress={() => {
            setConfirming(false);
            setTyped('');
          }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: TabBarClearance },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footer: { textAlign: 'center', fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, marginTop: Spacing.sm },
});
