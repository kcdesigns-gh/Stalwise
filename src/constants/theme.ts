// Stalwise look: royal blue and gold (approved 1 Nov 2026), in a light and a
// dark version. The dark version is the "glass" look: deep navy, see-through
// panels, gold accents.
//
// Each name says what the colour is FOR, so one name can have a different
// value in each look. On the web the values are CSS variables, which lets the
// look switch at once without reloading. On iPhone and Android the look is
// chosen when the app starts.
import { Platform } from 'react-native';

import { startupTheme } from '@/lib/theme-mode';

const light = {
  // Brand bands: page headers, the web sidebar, the sign-in background.
  deepBlue: '#12285F',
  /** Text and icons on a brand band. */
  onChrome: '#FFFFFF',
  /** Softer text on a brand band. */
  softBlue: '#C9D3EE',
  /** Outlines on a brand band. */
  midBlue: '#3A5296',
  /** Edge between a brand band and the page. */
  chromeBorder: 'rgba(255,255,255,0)',

  // Blue accents: toggles, dots, chart segments, blue badges.
  royalBlue: '#1D3F9E',
  /** Main button. */
  primary: '#1D3F9E',
  onPrimary: '#FFFFFF',
  primaryIcon: '#D4AF37',
  /** Second-choice button. */
  secondaryText: '#1D3F9E',
  secondaryBorder: '#1D3F9E',
  /** Tappable text and small outlines on a card. */
  link: '#1D3F9E',

  gold: '#D4AF37',
  /** Text on solid gold. */
  onGold: '#12285F',
  darkGold: '#7A5C0E',
  mutedGold: '#B8941F',
  lightGold: '#FBF5E3',

  background: '#F5F6FA',
  surface: '#FFFFFF',
  border: '#E1E5EF',
  divider: '#EEF1F8',
  inputBorder: '#C5CCDD',
  /** A chosen option (segment, chip, list choice). */
  selected: '#12285F',
  selectedBorder: '#12285F',
  tintBlue: '#E7ECFA',
  tintGreen: '#E3F3EA',

  text: '#0F1A33',
  textMuted: '#4A5470',
  /** Headings and big figures on a card. */
  heading: '#12285F',
  danger: '#B42318',
  dangerLight: '#FEF3F2',
  success: '#067647',
};

const dark: typeof light = {
  deepBlue: 'rgba(255,255,255,0.06)',
  onChrome: '#FFFFFF',
  softBlue: 'rgba(255,255,255,0.78)',
  midBlue: 'rgba(255,255,255,0.30)',
  chromeBorder: 'rgba(255,255,255,0.16)',

  royalBlue: '#4A6FE0',
  primary: '#E0BC4F',
  onPrimary: '#12285F',
  primaryIcon: '#12285F',
  secondaryText: '#FFFFFF',
  secondaryBorder: 'rgba(255,255,255,0.38)',
  link: '#E8C96A',

  gold: '#E8C96A',
  onGold: '#12285F',
  darkGold: '#F1D98A',
  mutedGold: '#D4AF37',
  lightGold: 'rgba(232,201,106,0.14)',

  background: '#081230',
  surface: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.20)',
  divider: 'rgba(255,255,255,0.12)',
  inputBorder: 'rgba(255,255,255,0.30)',
  selected: 'rgba(232,201,106,0.18)',
  selectedBorder: '#E8C96A',
  tintBlue: 'rgba(74,111,224,0.30)',
  tintGreen: 'rgba(99,219,160,0.18)',

  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.74)',
  heading: '#FFFFFF',
  danger: '#FF9B8E',
  dangerLight: 'rgba(255,120,100,0.14)',
  success: '#63DBA0',
};

type ColorName = keyof typeof light;
const names = Object.keys(light) as ColorName[];
const cssName = (name: string) => `--sw-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// Extra, web-only pieces of the glass look.
const GLASS_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.26), 0 18px 40px rgba(3,8,26,0.35)';
const GOLD_BUTTON = 'linear-gradient(180deg, #F1D98A 0%, #D4AF37 100%)';
// Soft gold and blue light over the whole page. It only ever lightens, and
// never takes a click.
const GLOW = [
  'radial-gradient(60vw 60vw at 100% -10%, rgba(212,175,55,0.20), rgba(212,175,55,0) 62%)',
  'radial-gradient(70vw 70vw at -10% 60%, rgba(58,98,214,0.34), rgba(58,98,214,0) 62%)',
  'radial-gradient(55vw 55vw at 85% 100%, rgba(29,63,158,0.40), rgba(29,63,158,0) 65%)',
].join(',');

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('sw-theme')) {
  const vars = (palette: typeof light) => names.map((n) => `${cssName(n)}:${palette[n]};`).join('');
  const style = document.createElement('style');
  style.id = 'sw-theme';
  style.textContent = [
    `:root{color-scheme:light;${vars(light)}--sw-card-shadow:none;--sw-primary-image:none;}`,
    `:root[data-theme="dark"]{color-scheme:dark;${vars(dark)}--sw-card-shadow:${GLASS_SHADOW};--sw-primary-image:${GOLD_BUTTON};}`,
    'html,body{background-color:var(--sw-background);}',
    `:root[data-theme="dark"] body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483000;mix-blend-mode:screen;background:${GLOW};}`,
    '@media print{:root[data-theme="dark"] body::after{display:none;}}',
  ].join('\n');
  document.head.appendChild(style);
}

function build(): Record<ColorName, string> {
  if (Platform.OS === 'web') {
    return Object.fromEntries(names.map((n) => [n, `var(${cssName(n)})`])) as Record<ColorName, string>;
  }
  return startupTheme === 'dark' ? dark : light;
}

export const Colors = build();

/** Web-only style values that differ between the looks (nothing on iPhone and Android). */
export const WebGlass = {
  cardShadow: 'var(--sw-card-shadow)',
  primaryImage: 'var(--sw-primary-image)',
} as const;

export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 16,
  pill: 999,
} as const;

/** Space to leave under scrolling content so it clears the native tab bar. */
export const TabBarClearance = 96;

/** Widest the content column gets on a tablet or office screen. */
export const ContentMaxWidth = 760;

/** Widest the top nav bar and wide (grid) screens get on a big office monitor. */
export const WideContentMaxWidth = 1180;
