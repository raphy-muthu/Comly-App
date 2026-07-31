/**
 * SectionHeader — a headline with an optional trailing action link.
 *   <SectionHeader title="Active Jobs" actionLabel="View All" onAction={...} />
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="headlineMd">{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="labelMd" color="textLink">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
