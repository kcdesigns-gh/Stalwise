import { router } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BlueHeader, Button, Card } from '@/components/ui';
import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { POLICY_UPDATED, PUBLISHER_NAME, SUPPORT_EMAIL } from '@/constants/legal';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Who we are',
    body: `Stalwise is a management app for horse stables, studs and trading yards, published by ${PUBLISHER_NAME} in South Africa. We are the responsible party under the Protection of Personal Information Act (POPIA). Contact us at ${SUPPORT_EMAIL}.`,
  },
  {
    title: 'What we collect',
    body: 'Your name, email address and password (stored securely, never in plain text). Whatever your business enters: horses, photos, notes, owners and clients (names, phone numbers, email and physical addresses), costs, invoices and payments, and your business name and logo. We also keep a record of changes made in the app, so a business can see who changed what.',
  },
  {
    title: 'Why we collect it',
    body: 'Only to run the app for you: to sign you in, keep your business records, work out costs and profit, and produce invoices. We do not sell your information, show advertising, track you across other apps or websites, or use analytics or advertising tools.',
  },
  {
    title: 'Who can see your records',
    body: 'Only the people your business adds to its own team, and only what their role allows. Money (costs, prices, invoices, profit and owners) is visible to Managers only. Other businesses using Stalwise cannot see your records.',
  },
  {
    title: 'Where it is stored',
    body: 'Records and photos are stored with our hosting provider, Supabase, in London, and sent over encrypted (HTTPS) connections. Our providers handle information only to run the service for us. Because the servers are outside South Africa, your information is transferred across the border, and we only use providers that protect it to a similar standard to POPIA.',
  },
  {
    title: 'Camera and photos',
    body: 'The camera is used only when you tap to take a photo of a horse. Photos and your business logo are chosen with your device’s photo picker. Nothing is read from your camera or photos without you choosing it.',
  },
  {
    title: 'Information about clients and owners',
    body: 'If you enter details about your clients or horse owners, you are responsible for having their permission and for using the details only for your business.',
  },
  {
    title: 'How long we keep it',
    body: 'For as long as your account or business exists. When you delete your account (More tab, then Delete account) your login is removed. If you are the Manager you can also delete the whole business: all its records, photos and logo are then permanently deleted.',
  },
  {
    title: 'Your rights',
    body: `You can ask to see, correct or delete your personal information by emailing ${SUPPORT_EMAIL}, or delete your account in the app. If you are unhappy with how we handle your information you can complain to the Information Regulator of South Africa.`,
  },
  {
    title: 'If you are in the United States',
    body: `We do not sell your personal information or share it for advertising. Depending on your state (for example California) you may have the right to know what we hold about you, to correct or delete it, and not to be treated differently for asking. Email ${SUPPORT_EMAIL} and we will respond within 45 days.`,
  },
  {
    title: 'Children',
    body: 'Stalwise is a business tool and is not meant for children.',
  },
  {
    title: 'Changes',
    body: 'If we change this policy we will update it here and change the date below.',
  },
];

export default function PrivacyScreen() {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1 }}>
      <BlueHeader title="Privacy policy" subtitle={`Updated ${POLICY_UPDATED}`} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <AppText variant="heading" accessibilityRole="header">
              {s.title}
            </AppText>
            <AppText>{s.body}</AppText>
          </Card>
        ))}
        <Button title="Email support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <Button kind="secondary" title="Close" onPress={back} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
});
