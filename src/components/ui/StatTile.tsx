/**
 * StatTile — a compact metric card (icon, big value, caption) used across the
 * customer/helper dashboards for things like "12 Jobs Completed" or
 * "96 Trust Score".
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Card } from './Card';
import { Text } from './Text';

export interface StatTileProps {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Tint for the icon chip. 'primary' follows the active role's accent. */
  tone?: 'primary' | 'secondary' | 'tertiary' | 'warning';
  caption?: string;
}

export function StatTile({
  value,
  label,
  icon,
  tone = 'primary',
  caption,
}: StatTileProps) {
  const role = useRoleTheme();
  const TONES = {
    primary: { bg: role.accentSoft, fg: role.accent },
    secondary: { bg: colors.infoSoft, fg: colors.secondary },
    tertiary: { bg: colors.successSoft, fg: colors.tertiary },
    warning: { bg: colors.warningContainer, fg: colors.warning },
  } as const;
  const t = TONES[tone];
  return (
    <Card style={styles.card} padded>
      <View style={styles.header}>
        <View style={[styles.iconChip, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={18} color={t.fg} />
        </View>
        {caption && (
          <Text variant="caption" color="textSecondary">
            {caption}
          </Text>
        )}
      </View>
      <Text variant="headlineMd" style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { marginBottom: 2 },
});
