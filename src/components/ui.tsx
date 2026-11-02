import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Colors, ContentMaxWidth, Fonts, Radius, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type TextVariant = 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'small' | 'figure';

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; muted?: boolean; color?: string }) {
  return (
    <Text
      {...rest}
      style={[textStyles[variant], muted && { color: Colors.textMuted }, color ? { color } : null, style]}
    />
  );
}

const textStyles = StyleSheet.create({
  title: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.text },
  heading: { fontFamily: Fonts.extrabold, fontSize: 15, color: Colors.deepBlue },
  body: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text },
  bodyStrong: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.text },
  label: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.textMuted },
  small: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted },
  figure: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.deepBlue },
});

// ---------------------------------------------------------------------------
// Business logo (uploaded image, or initials in a gold ring)
// ---------------------------------------------------------------------------

export function initialsOf(name: string): string {
  const words = name.replace(/['’]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
}

export function LogoMark({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[ring, { borderWidth: 2, borderColor: Colors.gold, backgroundColor: Colors.surface }]}
        contentFit="cover"
        accessibilityLabel={`${name} logo`}
      />
    );
  }
  return (
    <View style={[ring, styles.logoFallback]} accessibilityLabel={`${name} logo`}>
      <Text style={[styles.logoInitials, { fontSize: size * 0.34 }]}>{initialsOf(name).toUpperCase()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header: deep blue with a gold underline, drawn under the status bar
// ---------------------------------------------------------------------------

export function BlueHeader({
  title,
  subtitle,
  logo,
  right,
  showBack,
  children,
}: {
  title: string;
  subtitle?: string;
  logo?: ReactNode;
  right?: ReactNode;
  showBack?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.headerInner}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.iconButton}
            hitSlop={8}>
            <Icon name="back" color={Colors.surface} size={22} />
          </Pressable>
        ) : null}
        {logo}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
      </View>
    </View>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerIconButton, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} color={Colors.gold} size={20} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, gold, style }: { children: ReactNode; gold?: boolean; style?: ViewStyle }) {
  return <View style={[styles.card, gold && styles.cardGold, style]}>{children}</View>;
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.statTile}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="figure">{value}</AppText>
      {note ? <AppText variant="small">{note}</AppText> : null}
    </View>
  );
}

export function DetailRow({
  label,
  value,
  last,
  onPress,
}: {
  label: string;
  value: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const row = (
    <View style={[styles.detailRow, !last && styles.divider]}>
      <AppText muted>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
  if (!onPress) return row;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {row}
    </Pressable>
  );
}

export function Badge({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'blue' | 'outline' | 'muted' }) {
  return (
    <View style={[styles.badge, badgeTones[tone]]}>
      <Text style={[styles.badgeText, { color: badgeTextColors[tone] }]}>{label}</Text>
    </View>
  );
}

const badgeTones = StyleSheet.create({
  gold: { backgroundColor: Colors.gold },
  blue: { backgroundColor: Colors.royalBlue },
  outline: { borderWidth: 1, borderColor: Colors.midBlue },
  muted: { backgroundColor: Colors.divider },
});

const badgeTextColors = {
  gold: Colors.deepBlue,
  blue: Colors.surface,
  outline: Colors.surface,
  muted: Colors.deepBlue,
} as const;

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <AppText variant="heading">{title}</AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={Colors.royalBlue} />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="polite">
      <AppText color={Colors.danger}>{message}</AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type ButtonKind = 'primary' | 'secondary' | 'gold';

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const off = disabled || loading;
  const textColor = kind === 'primary' ? Colors.surface : kind === 'gold' ? Colors.darkGold : Colors.royalBlue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        buttonKinds[kind],
        off && { opacity: 0.55 },
        pressed && !off && { opacity: 0.85 },
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={kind === 'primary' ? Colors.gold : textColor} size={18} /> : null}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonKinds = StyleSheet.create({
  primary: { backgroundColor: Colors.royalBlue },
  secondary: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.royalBlue },
  gold: { backgroundColor: Colors.lightGold, borderWidth: 1.5, borderColor: Colors.gold },
});

export function TextField({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, input.multiline && styles.inputMultiline, input.style]}
      />
      {hint ? <AppText variant="small">{hint}</AppText> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.segmentRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected, disabled && { opacity: 0.55 }]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; note?: string }[];
  value: T | null;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={{ gap: Spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.choice, selected && styles.choiceSelected]}>
              <AppText style={{ fontFamily: selected ? Fonts.bold : Fonts.semibold }} color={selected ? Colors.gold : Colors.text}>
                {option.label}
              </AppText>
              {option.note ? (
                <AppText variant="small" color={selected ? Colors.softBlue : Colors.textMuted}>
                  {option.note}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.toggleRow, !last && styles.divider]}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <View style={[styles.toggleTrack, value ? styles.toggleOn : styles.toggleOff]}>
        <View style={[styles.toggleKnob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// IconStat: a round icon badge beside a label/value pair — used for a horse's
// key facts and dashboard figures, in place of a plain row of text.
// ---------------------------------------------------------------------------

export function IconStat({
  icon,
  label,
  value,
  tone = 'blue',
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: 'blue' | 'gold' | 'green';
}) {
  return (
    <View style={statStyles.row}>
      <View style={[statStyles.badge, statBadgeTones[tone]]}>
        <Icon name={icon} size={18} color={statIconColors[tone]} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="small">{label}</AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const statBadgeTones = StyleSheet.create({
  blue: { backgroundColor: '#E7ECFA' },
  gold: { backgroundColor: Colors.lightGold },
  green: { backgroundColor: '#E3F3EA' },
});

const statIconColors = {
  blue: Colors.royalBlue,
  gold: Colors.darkGold,
  green: Colors.success,
} as const;

const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: '48%' },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

// ---------------------------------------------------------------------------
// IconStatGrid: lays IconStats out two to a row, wrapping as needed.
// ---------------------------------------------------------------------------

export function IconStatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>{children}</View>;
}

// ---------------------------------------------------------------------------
// CostBreakdownBar: a stacked horizontal bar with a colour-keyed legend —
// a chart that works the same on native and web with no extra library.
// ---------------------------------------------------------------------------

const BREAKDOWN_COLORS = [Colors.gold, Colors.royalBlue, Colors.midBlue, Colors.mutedGold, Colors.softBlue, Colors.textMuted];

export function CostBreakdownBar({
  items,
  formatValue,
}: {
  items: { label: string; value: number }[];
  formatValue: (value: number) => string;
}) {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.value), 0);
  const shown = items.filter((i) => i.value > 0);
  if (total <= 0 || shown.length === 0) {
    return <AppText muted>Nothing logged yet.</AppText>;
  }
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={breakdownStyles.bar}>
        {shown.map((item, i) => (
          <View
            key={item.label}
            style={{
              flex: Math.max(item.value, total * 0.01),
              backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length],
            }}
          />
        ))}
      </View>
      <View style={breakdownStyles.legend}>
        {shown.map((item, i) => (
          <View key={item.label} style={breakdownStyles.legendRow}>
            <View style={[breakdownStyles.dot, { backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }]} />
            <AppText variant="small" style={{ flex: 1 }}>
              {item.label}
            </AppText>
            <AppText variant="small" style={{ fontFamily: Fonts.semibold }}>
              {formatValue(item.value)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: Colors.divider },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

const styles = StyleSheet.create({
  logoFallback: {
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.deepBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: { fontFamily: Fonts.extrabold, color: Colors.gold, letterSpacing: 0.5 },
  header: {
    backgroundColor: Colors.deepBlue,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  headerInner: { width: '100%', maxWidth: ContentMaxWidth, alignSelf: 'center', gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: Fonts.extrabold, fontSize: 20, color: Colors.surface },
  headerSubtitle: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.softBlue, marginTop: 2 },
  iconButton: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardGold: { borderWidth: 1.5, borderColor: Colors.gold },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    gap: 4,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: Spacing.md },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  badgeText: { fontFamily: Fonts.bold, fontSize: 12 },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 40, paddingHorizontal: Spacing.xxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  buttonText: { fontFamily: Fonts.extrabold, fontSize: 15 },
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputMultiline: { minHeight: 96, paddingTop: Spacing.md, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  segment: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: Colors.deepBlue, borderColor: Colors.deepBlue },
  segmentText: { fontFamily: Fonts.semibold, fontSize: 14, color: Colors.text },
  segmentTextSelected: { color: Colors.gold, fontFamily: Fonts.bold },
  choice: {
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 2,
    justifyContent: 'center',
  },
  choiceSelected: { backgroundColor: Colors.deepBlue, borderColor: Colors.deepBlue },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: Spacing.md },
  toggleTrack: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: Colors.royalBlue },
  toggleOff: { backgroundColor: Colors.inputBorder },
  toggleKnob: { width: 24, height: 24, borderRadius: 12 },
  knobOn: { backgroundColor: Colors.gold, alignSelf: 'flex-end' },
  knobOff: { backgroundColor: Colors.surface, alignSelf: 'flex-start' },
});
