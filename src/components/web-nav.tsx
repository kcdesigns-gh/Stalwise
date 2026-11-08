// Persistent left sidebar for the web app (office browsers), shown beside
// every screen so a page two levels deep (a horse, an invoice) still has a
// way back to the other sections. Replaces the earlier top bar (9 Nov 2026,
// Karel's request) — not the phone app, which keeps its own bottom tabs.
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { LogoMark } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { ROLE_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth';
import { useBusiness } from '@/providers/business';

type NavItem = { href: '/' | '/horses' | '/stalls' | '/invoices' | '/more'; label: string; icon: IconName; show: boolean };

/** Width of the sidebar on a normal office monitor vs. a narrower window. */
const FULL_WIDTH = 232;
const COMPACT_WIDTH = 72;
/** Below this, there isn't room for labels next to the icons. */
const COMPACT_BREAKPOINT = 1040;

export function WebSidebarNav() {
  const { business, logoUrl, isManager, role } = useBusiness();
  const { session, signOut } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  if (!business) return null;
  const seesStalls = role === 'manager' || role === 'trainer';
  const compact = width < COMPACT_BREAKPOINT;
  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];

  const items: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: 'home', show: true },
    { href: '/horses', label: 'Horses', icon: 'horses', show: true },
    { href: '/stalls', label: 'Stalls', icon: 'stalls', show: seesStalls },
    { href: '/invoices', label: 'Invoices', icon: 'invoices', show: isManager },
    { href: '/more', label: 'More', icon: 'more', show: true },
  ];

  return (
    <View style={[styles.sidebar, { width: compact ? COMPACT_WIDTH : FULL_WIDTH }]}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/')} style={[styles.brand, compact && styles.brandCompact]}>
        <LogoMark name={business.name} uri={logoUrl} size={32} />
        {!compact ? (
          <Text style={styles.brandText} numberOfLines={1}>
            {business.name}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.links}>
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
                <Icon name={item.icon} color={focused ? Colors.deepBlue : Colors.softBlue} size={18} />
                {!compact ? <Text style={[styles.linkText, focused && styles.linkTextActive]}>{item.label}</Text> : null}
              </Pressable>
            );
          })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={signOut}
        style={[styles.account, compact && styles.accountCompact]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(firstName ?? business.name).charAt(0).toUpperCase()}</Text>
        </View>
        {!compact ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.accountName} numberOfLines={1}>
              {firstName ?? session?.user.email ?? 'Account'}
            </Text>
            <Text style={styles.accountRole} numberOfLines={1}>
              {role ? ROLE_LABELS[role] : ''}
            </Text>
          </View>
        ) : null}
        {!compact ? <Icon name="logout" color={Colors.softBlue} size={16} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { backgroundColor: Colors.deepBlue, flexDirection: 'column' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg },
  brandCompact: { justifyContent: 'center', paddingHorizontal: Spacing.sm },
  brandText: { fontFamily: Fonts.extrabold, fontSize: 16, color: Colors.surface, flexShrink: 1 },
  links: { flex: 1, gap: 2, paddingHorizontal: Spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  linkCompact: { paddingHorizontal: 0, justifyContent: 'center' },
  linkActive: { backgroundColor: Colors.gold },
  linkText: { fontFamily: Fonts.semibold, fontSize: 14, color: Colors.softBlue },
  linkTextActive: { fontFamily: Fonts.bold, color: Colors.deepBlue },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  accountCompact: { justifyContent: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.extrabold, fontSize: 13, color: Colors.deepBlue },
  accountName: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.surface },
  accountRole: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.softBlue, marginTop: 1 },
});
