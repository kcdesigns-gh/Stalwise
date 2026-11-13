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

/** Email links that sign a person in. Only "recovery" also asks for a new password. */
const SIGN_IN_LINK_TYPES = ['recovery', 'signup', 'magiclink', 'invite', 'email_change'];

/** Take the sign-in token out of the address bar and the browser history. */
function clearLinkFromAddressBar() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/**
 * Looks for an email link in the current URL (web) or the link that opened the
 * app (native): a password reset, or the "confirm your email" link sent at
 * sign-up. Signs the person in with it and removes the token from the address
 * bar, where it would otherwise stay in the browser history.
 * Returns true only when a password-recovery session was started.
 */
export async function consumeRecoveryLink(): Promise<boolean> {
  const url = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.href : '') : ((await Linking.getInitialURL()) ?? '');
  if (!url) return false;
  const params = paramsFrom(url);
  const hasTokens = !!(params.access_token && params.refresh_token);

  // A failed or expired link carries an error and no token: just tidy the address.
  if (params.error_code || params.error_description) {
    clearLinkFromAddressBar();
    return false;
  }

  if (hasTokens && params.type && SIGN_IN_LINK_TYPES.includes(params.type)) {
    // Clear first: the token is already read, and signing in can take a while.
    clearLinkFromAddressBar();
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return !error && params.type === 'recovery';
  }
  if (hasTokens) {
    // A token of a kind we do not use: never leave it in the address bar.
    clearLinkFromAddressBar();
    return false;
  }
  if (params.code && params.type === 'recovery') {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    clearLinkFromAddressBar();
    return !error;
  }
  return false;
}
