import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { WebSidebarNav } from '@/components/web-nav';
import { Colors, Spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth';
import { BusinessProvider, useBusiness } from '@/providers/business';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading: authLoading, recovering, signOut } = useAuth();
  const { business, loading: businessLoading, error: businessError, refresh } = useBusiness();
  const [retrying, setRetrying] = useState(false);

  const ready = !authLoading && (!session || !businessLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;

  // The business could not be loaded (no connection, server trouble). Say so
  // and offer a retry. Without this the person would land on "Set up your
  // business" and could create a second one by mistake.
  if (signedIn && businessError && !recovering) {
    const retry = async () => {
      setRetrying(true);
      await refresh();
      setRetrying(false);
    };
    return (
      <View style={styles.problem}>
        <View style={styles.problemCard}>
          <AppText variant="heading" accessibilityRole="header">
            We couldn’t load your business
          </AppText>
          <AppText>Check your internet connection, then try again. Your records are safe.</AppText>
          <Button title="Try again" onPress={retry} loading={retrying} />
          <Button kind="secondary" title="Sign out" onPress={signOut} disabled={retrying} />
        </View>
      </View>
    );
  }

  const hasBusiness = signedIn && !!business;

  const showSidebar = Platform.OS === 'web' && hasBusiness && !recovering;

  return (
    <View style={{ flex: 1, flexDirection: showSidebar ? 'row' : 'column' }}>
      {showSidebar ? <WebSidebarNav /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Protected guard={recovering}>
            <Stack.Screen name="reset-password" />
          </Stack.Protected>

          <Stack.Protected guard={!signedIn && !recovering}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>

          <Stack.Protected guard={signedIn && !hasBusiness && !recovering}>
            <Stack.Screen name="setup" />
          </Stack.Protected>

          <Stack.Protected guard={hasBusiness && !recovering}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="horse/[id]" />
            <Stack.Screen name="horse/edit/[id]" />
            <Stack.Screen name="horse/sell/[id]" />
            <Stack.Screen name="photo/[id]" />
            <Stack.Screen name="horse/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="business" />
            <Stack.Screen name="staff" />
            <Stack.Screen name="owners" />
            <Stack.Screen name="owner/[id]" />
            <Stack.Screen name="owner/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="shared-costs" />
            <Stack.Screen name="cost/edit/[id]" />
            <Stack.Screen name="feed-log/edit/[id]" />
            <Stack.Screen name="invoice/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="invoice/[id]" />
            <Stack.Screen name="health/[horseId]" />
            <Stack.Screen name="tasks" />
            <Stack.Screen name="training/[horseId]" />
            <Stack.Screen name="breeding/[horseId]" />
            <Stack.Screen name="products" />
            <Stack.Screen name="feed-rate" />
            <Stack.Screen name="stall/[id]" />
            <Stack.Screen name="stall/manage" />
            <Stack.Screen name="assign/[horseId]" />
            <Stack.Screen name="waiting/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="log/[horseId]" options={{ presentation: 'modal' }} />
          </Stack.Protected>

          {/* Open to everyone. Kept last on purpose: the first screen that is
              allowed is where "/" lands, and that must be sign-in, setup or the
              dashboard, never the privacy policy. */}
          <Stack.Screen name="privacy" />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <BusinessProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </BusinessProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  problem: { flex: 1, backgroundColor: Colors.deepBlue, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  problemCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
