/**
 * TrustBadge — compact "trusted" indicator shown next to names. A user becomes
 * trusted via a strong reputation score + completed jobs (see UserProfile.isTrusted).
 * Renders nothing when the user isn't trusted yet (unless a label is forced).
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

export interface TrustBadgeProps {
  trusted?: boolean;
  /** Override the default "Trusted" label (e.g. "Trusted Customer"). */
  label?: string;
  compact?: boolean;
}

export function TrustBadge({ trusted = true, label, compact }: TrustBadgeProps) {
  if (!trusted) return null;

  return (
    <View style={styles.badge}>
      <Ionicons name="shield-checkmark" size={14} color={colors.tertiary} />
      {!compact && (
        <Text variant="labelMd" color="tertiary" style={styles.label}>
          {label ?? 'Trusted'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.base,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  label: { marginLeft: 4 },
});
