import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText, BlueHeader, Button, Card, DetailRow, ErrorText, LogoMark, ToggleRow } from '@/components/ui';
import { Colors, ContentMaxWidth, Fonts, Spacing, TabBarClearance } from '@/constants/theme';
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
  { key: 'owner_updates', label: 'WhatsApp and email updates to owners' },
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

        <Text style={styles.footer}>
          Powered by Stal<Text style={{ color: Colors.mutedGold }}>wise</Text> · version {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: TabBarClearance },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footer: { textAlign: 'center', fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, marginTop: Spacing.sm },
});
