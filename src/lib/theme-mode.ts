// Light or dark look. The choice is stored on the device: Light, Dark, or
// "Match device" (follow the phone's or computer's own setting).
//
// Web switches instantly (the colours are CSS variables, see constants/theme).
// iPhone and Android pick the look once at start-up, so a change there shows
// the next time the app is opened.
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import { sessionStorage } from '@/lib/session-storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeName = 'light' | 'dark';

const KEY = 'stalwise.theme';
const isWeb = Platform.OS === 'web';
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = sessionStorage?.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage blocked (private browsing): use the default.
  }
  // Dark is the default look. Anyone can switch under More > Appearance.
  return 'dark';
}

function deviceTheme(): ThemeName {
  if (isWeb) {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function resolve(pref: ThemePreference): ThemeName {
  return pref === 'system' ? deviceTheme() : pref;
}

let preference: ThemePreference = readPreference();
/** The look in force when the app started. On iPhone and Android this stays put until the app is reopened. */
export const startupTheme: ThemeName = resolve(preference);
let current: ThemeName = startupTheme;

function applyToPage() {
  if (isWeb && typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', current);
}

function update() {
  const next = isWeb ? resolve(preference) : startupTheme;
  if (next !== current) {
    current = next;
    applyToPage();
  }
  listeners.forEach((l) => l());
}

applyToPage();
if (isWeb && typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', update);
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    sessionStorage?.setItem(KEY, next);
  } catch {
    // Not saved; the choice still applies until the page is closed.
  }
  update();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The look on screen right now. */
export function useThemeName(): ThemeName {
  return useSyncExternalStore(subscribe, () => current, () => 'dark' as ThemeName);
}

export function useIsDark(): boolean {
  return useThemeName() === 'dark';
}

/** The saved choice, for the settings screen. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference, () => 'dark' as ThemePreference);
}

/** True where a change only shows after the app is reopened. */
export const themeNeedsRestart = !isWeb;
