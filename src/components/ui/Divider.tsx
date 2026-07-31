/**
 * Divider — hairline separator. Use `inset` to start it past list iconography.
 */

import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';

export interface DividerProps {
  inset?: boolean;
  spacingY?: number;
}

export function Divider({ inset = false, spacingY = 0 }: DividerProps) {
  return (
    <View
      style={[
        styles.line,
        inset && styles.inset,
        spacingY > 0 && { marginVertical: spacingY },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  inset: { marginLeft: spacing.lg },
});
