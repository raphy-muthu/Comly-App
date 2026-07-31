/**
 * IconButton — circular tappable icon for headers (back, notifications, etc.).
 */

import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/** "arrow-back" → "arrow back", "ellipsis-horizontal" → "more options". */
function labelFromIcon(icon: string): string {
  if (icon.startsWith('ellipsis')) return 'more options';
  return icon.replace(/-(outline|sharp)$/g, '').replace(/-/g, ' ');
}

export function IconButton({
  icon,
  onPress,
  size = 24,
  color = colors.textPrimary,
  background = colors.transparent,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? labelFromIcon(icon)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
