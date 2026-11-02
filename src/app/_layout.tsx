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
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth';
import { BusinessProvider, useBusiness } from '@/providers/business';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading: authLoading, recovering } = useAuth();
  const { business, loading: businessLoading } = useBusiness();

  const ready = !authLoading && (!session || !businessLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  const hasBusiness = signedIn && !!business;

  return (
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
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="products" />
        <Stack.Screen name="feed-rate" />
        <Stack.Screen name="stall/[id]" />
        <Stack.Screen name="stall/manage" />
        <Stack.Screen name="assign/[horseId]" />
        <Stack.Screen name="waiting/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="log/[horseId]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
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
