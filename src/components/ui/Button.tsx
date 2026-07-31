/**
 * Button — three variants, role-tinted (violet for customers, green for
 * helpers) via the active role theme.
 *
 *  primary   → role gradient fill, white bold text, pill shape, soft lift
 *  secondary → transparent with a 2px role-accent border
 *  ghost     → role-accent text only, no border
 */

import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
}

const HEIGHTS: Record<Size, number> = { lg: 56, md: 48, sm: 40 };

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = true,
  icon,
  iconPosition = 'left',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const height = HEIGHTS[size];
  const isDisabled = disabled || loading;

  // Accent follows the active role (violet for customers, green for helpers).
  const role = useRoleTheme();
  const contentColor = variant === 'primary' ? colors.onPrimary : role.accent;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={20}
              color={contentColor}
              style={styles.iconLeft}
            />
          )}
          <Text variant="bodyLg" style={[styles.label, { color: contentColor }]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={20}
              color={contentColor}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </View>
  );

  const base: ViewStyle = {
    height,
    borderRadius: radius.full,
    opacity: isDisabled ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
  };

  if (variant === 'primary') {
    return (
      <Pressable
        disabled={isDisabled}
        style={({ pressed }) => [
          !isDisabled && shadows.card,
          pressed && styles.pressed,
        ]}
        {...rest}
      >
        <LinearGradient
          colors={role.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[base, styles.center, style]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        base,
        styles.center,
        variant === 'secondary' && { borderWidth: 2, borderColor: role.accent },
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  label: { fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  iconLeft: { marginRight: spacing.base },
  iconRight: { marginLeft: spacing.base },
});
