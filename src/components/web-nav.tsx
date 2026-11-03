// Persistent top bar for the web app (office browsers), shown above every
// screen's own header so a page two levels deep (a horse, an invoice) still
// has a way back to the other sections — not just the phone's bottom tabs
// redrawn at the top, but a real nav bar that stays put.
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { LogoMark } from '@/components/ui';
import { Colors, Fonts, Spacing, WideContentMaxWidth } from '@/constants/theme';
import { useBusiness } from '@/providers/business';

type NavItem = { href: '/' | '/horses' | '/stalls' | '/invoices' | '/more'; label: string; icon: IconName; show: boolean };

export function WebTopNav() {
  const { business, logoUrl, isManager, role } = useBusiness();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  if (!business) return null;
  const seesStalls = role === 'manager' || role === 'trainer';
  const compact = width < 680;
  const hideBrandText = width < 520;

  const items: NavItem[] = [
    { href: '/', label: 'Home', icon: 'home', show: true },
    { href: '/horses', label: 'Horses', icon: 'horses', show: true },
    { href: '/stalls', label: 'Stalls', icon: 'stalls', show: seesStalls },
    { href: '/invoices', label: 'Invoices', icon: 'invoices', show: isManager },
    { href: '/more', label: 'More', icon: 'more', show: true },
  ];

  return (
    <View style={styles.bar}>
      <View style={[styles.inner, compact && { paddingHorizontal: Spacing.md, gap: Spacing.sm }]}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/')} style={styles.brand}>
          <LogoMark name={business.name} uri={logoUrl} size={30} />
          {!hideBrandText ? (
            <Text style={styles.brandText} numberOfLines={1}>
              {business.name}
            </Text>
          ) : null}
        </Pressable>
        <View style={[styles.links, compact && { gap: 0 }]}>
          {items
            .filter((i) => i.show)
            .map((item) => {
              const focused = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: focused }}
                  onPress={() => router.push(item.href)}
                  style={[styles.link, compact && styles.linkCompact, focused && styles.linkActive]}>
                  <Icon name={item.icon} color={focused ? Colors.gold : Colors.softBlue} size={16} />
                  {!compact ? <Text style={[styles.linkText, focused && styles.linkTextActive]}>{item.label}</Text> : null}
                </Pressable>
              );
            })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: Colors.deepBlue },
  inner: {
    width: '100%',
    maxWidth: WideContentMaxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    height: 52,
    gap: Spacing.xl,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  brandText: { fontFamily: Fonts.extrabold, fontSize: 15, color: Colors.surface, flexShrink: 1 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  linkCompact: { paddingHorizontal: 9, gap: 0 },
  linkActive: { backgroundColor: 'rgba(212,175,55,0.14)' },
  linkText: { fontFamily: Fonts.semibold, fontSize: 13, color: Colors.softBlue },
  linkTextActive: { fontFamily: Fonts.bold, color: Colors.surface },
});
