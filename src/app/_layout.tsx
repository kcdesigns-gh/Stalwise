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
  const { session, loading: authLoading } = useAuth();
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
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasBusiness}>
        <Stack.Screen name="setup" />
      </Stack.Protected>

      <Stack.Protected guard={hasBusiness}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="horse/[id]" />
        <Stack.Screen name="horse/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="business" />
        <Stack.Screen name="products" />
        <Stack.Screen name="feed-rate" />
        <Stack.Screen name="stall/[id]" />
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
