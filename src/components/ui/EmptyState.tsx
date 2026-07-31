/**
 * EmptyState — friendly placeholder for empty lists (no jobs, no alerts, etc.).
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const role = useRoleTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: role.accentSoft }]}>
        <Ionicons name={icon} size={32} color={role.accent} />
      </View>
      <Text variant="headlineMd" center style={styles.title}>
        {title}
      </Text>
      {message && (
        <Text variant="bodyMd" color="textSecondary" center style={styles.message}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          fullWidth={false}
          size="md"
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.base },
  message: { marginBottom: spacing.md },
  action: { marginTop: spacing.base },
});
