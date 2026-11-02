import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

// One name per icon, mapped to Apple SF Symbols (iPhone) and Material
// Symbols (Android and web), so every platform shows a real icon.
const ICONS = {
  back: { ios: 'chevron.left', md: 'chevron_left' },
  add: { ios: 'plus', md: 'add' },
  crown: { ios: 'crown.fill', md: 'crown' },
  upload: { ios: 'square.and.arrow.up', md: 'upload' },
  home: { ios: 'house', md: 'home' },
  horses: { ios: 'list.bullet.rectangle', md: 'list' },
  stalls: { ios: 'square.grid.2x2', md: 'grid_view' },
  invoices: { ios: 'doc.text', md: 'receipt_long' },
  more: { ios: 'ellipsis.circle', md: 'more_horiz' },
  camera: { ios: 'camera', md: 'photo_camera' },
  gallery: { ios: 'photo.on.rectangle', md: 'photo_library' },
} as const satisfies Record<string, { ios: SFSymbol; md: string }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.md, web: icon.md }}
      size={size}
      tintColor={color}
      aria-hidden
    />
  );
}
