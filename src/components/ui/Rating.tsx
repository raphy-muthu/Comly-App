/**
 * Rating — inline star + numeric score, optionally with a job count.
 *   <Rating value={4.9} count={120} />  →  ★ 4.9 · 120 jobs
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { Text } from './Text';

export interface RatingProps {
  value: number;
  count?: number;
  countLabel?: string;
  size?: number;
}

export function Rating({
  value,
  count,
  countLabel = 'jobs',
  size = 14,
}: RatingProps) {
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.warning} />
      <Text variant="labelMd" color="textPrimary" style={styles.value}>
        {value.toFixed(1)}
      </Text>
      {count !== undefined && (
        <Text variant="caption" color="textSecondary">
          {' · '}
          {count} {countLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { marginLeft: 4 },
});
