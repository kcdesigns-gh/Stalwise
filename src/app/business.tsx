import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusinessForm } from '@/components/business-form';
import { BlueHeader, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formValuesFrom, saveBusinessProfile } from '@/lib/business';
import { useBusiness } from '@/providers/business';

export default function BusinessProfileScreen() {
  const insets = useSafeAreaInsets();
  const { business, logoUrl, isManager, refresh } = useBusiness();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlueHeader title="Business profile" showBack />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {isManager && business ? (
          <BusinessForm
            initial={formValuesFrom(business)}
            currentLogoUrl={logoUrl}
            submitLabel="Save changes"
            onSubmit={async (values, logo) => {
              await saveBusinessProfile(business.id, values, logo);
              await refresh();
              router.back();
            }}
          />
        ) : (
          <View>
            <ErrorText message="Only the Manager can change the business profile." />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
