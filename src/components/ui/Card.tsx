/**
 * Card — white surface, large radius, soft ambient shadow.
 * Pass `onPress` to make it tappable (adds a subtle press state).
 */

import { Pressable, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  /** lg (16) for feed cards, xl (24) for hero marketplace cards. */
  rounded?: 'lg' | 'xl';
  elevation?: 'card' | 'floating' | 'none';
  style?: ViewStyle;
}

export function Card({
  onPress,
  padded = true,
  rounded = 'lg',
  elevation = 'card',
  style,
  children,
  ...rest
}: CardProps) {
  const cardStyle: ViewStyle[] = [
    styles.base,
    { borderRadius: radius[rounded] },
    padded && styles.padded,
    elevation !== 'none' && shadows[elevation],
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  padded: { padding: spacing.md },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});
