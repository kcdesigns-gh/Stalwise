// Stalwise look: fixed royal blue and gold for every business (approved 1 Nov 2026).

export const Colors = {
  deepBlue: '#12285F',
  royalBlue: '#1D3F9E',
  midBlue: '#3A5296',
  softBlue: '#C9D3EE',
  gold: '#D4AF37',
  darkGold: '#7A5C0E',
  mutedGold: '#B8941F',
  lightGold: '#FBF5E3',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  border: '#E1E5EF',
  divider: '#EEF1F8',
  inputBorder: '#C5CCDD',
  text: '#0F1A33',
  textMuted: '#4A5470',
  danger: '#B42318',
  dangerLight: '#FEF3F2',
  success: '#067647',
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
