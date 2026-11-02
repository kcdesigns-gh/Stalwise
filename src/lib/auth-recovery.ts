import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Where Supabase should send someone after they tap the reset-password email link. */
export function recoveryRedirectUrl(): string {
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.origin : '';
  return Linking.createURL('/');
}

function paramsFrom(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [key, value] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
    }
  }
  return params;
}

/**
 * Looks for a password-recovery link in the current URL (web) or the link that
 * opened the app (native), and signs the person into a recovery session if found.
 * Returns true when a recovery session was started.
 */
export async function consumeRecoveryLink(): Promise<boolean> {
  const url = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.href : '') : ((await Linking.getInitialURL()) ?? '');
  if (!url) return false;
  const params = paramsFrom(url);
  if (params.type !== 'recovery') return false;

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return !error;
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return !error;
  }
  return false;
}
