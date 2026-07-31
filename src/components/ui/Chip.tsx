/**
 * Chip — pill-shaped tag for categories, statuses, and filters.
 *
 * Tones use low-saturation fills with high-contrast text so they read clearly
 * without competing with primary buttons. Pass `selected` for filter chips
 * (e.g. the "Nearby / Highest Pay / Quick Jobs" row in the job feed). The
 * `selected` state and `primary` tone follow the active role (violet for
 * customers, green for helpers).
 */

import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from './Text';

export type ChipTone =
  | 'neutral'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const STATIC_TONES: Record<Exclude<ChipTone, 'primary'>, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceContainerHigh, fg: colors.textSecondary },
  success: { bg: colors.successSoft, fg: colors.successText },
  info: { bg: colors.infoSoft, fg: colors.secondary },
  warning: { bg: colors.warningContainer, fg: colors.warning },
  danger: { bg: colors.errorContainer, fg: colors.error },
};

export function Chip({
  label,
  tone = 'neutral',
  icon,
  selected = false,
  onPress,
  style,
}: ChipProps) {
  const role = useRoleTheme();
  const toneColors =
    tone === 'primary' ? { bg: role.accentSoft, fg: role.accent } : STATIC_TONES[tone];
  // Selected filter chips invert to the active role's accent.
  const bg = selected ? role.accent : toneColors.bg;
  const fg = selected ? role.onAccent : toneColors.fg;

  const inner = (
    <>
      {icon && <Ionicons name={icon} size={14} color={fg} style={styles.icon} />}
      <Text variant="labelMd" style={[styles.label, { color: fg }]}>
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: bg },
          pressed && styles.pressed,
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>{inner}</View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  pressed: { opacity: 0.8 },
  icon: { marginRight: 4 },
  label: { letterSpacing: 0.2 },
});
