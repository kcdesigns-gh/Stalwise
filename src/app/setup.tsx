import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusinessForm, EMPTY_BUSINESS } from '@/components/business-form';
import { Button } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { createBusiness } from '@/lib/business';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { refresh } = useBusiness();
  const { signOut } = useAuth();

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
            Set up your business
          </Text>
          <Text style={styles.subtitle}>Your name and logo appear on your screens and invoices.</Text>
        </View>

        <View style={styles.body}>
          <BusinessForm
            initial={EMPTY_BUSINESS}
            submitLabel="Create my business"
            onSubmit={async (values, logo) => {
              await createBusiness(values, logo);
              await refresh();
            }}
          />
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
  wordmark: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.surface, marginBottom: 8 },
  title: { fontFamily: Fonts.extrabold, fontSize: 20, color: Colors.surface },
  subtitle: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.softBlue },
  body: { padding: Spacing.lg, gap: Spacing.md },
});
