/**
 * Typed Text — renders a typography variant with a color token.
 *
 *   <Text variant="headlineMd">Good afternoon, Sarah</Text>
 *   <Text variant="bodyMd" color="textSecondary">Bryn Mawr</Text>
 *
 * `color="primary"` and `color="textLink"` follow the active role (violet for
 * customers, green for helpers) so brand text/links re-tint with the rest of
 * the interface when switching roles.
 */

import { StyleSheet, Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors, fontFamily, typography, TypographyVariant } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';

type ColorKey = keyof typeof colors;

/**
 * Each weight of Plus Jakarta Sans is its own font family. iOS will find the
 * right file from a fontWeight on a custom family, but Android ignores it or
 * fakes a bold, so a `fontWeight` passed in `style` is turned into the
 * matching family here, the same on both platforms.
 */
// Keyed by String(fontWeight), since React Native accepts both 700 and '700'.
const FAMILY_FOR_WEIGHT: Record<string, string> = {
  '400': fontFamily.regular,
  normal: fontFamily.regular,
  '500': fontFamily.medium,
  '600': fontFamily.semibold,
  '700': fontFamily.bold,
  bold: fontFamily.bold,
  '800': fontFamily.extrabold,
  '900': fontFamily.extrabold,
};

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorKey;
  center?: boolean;
}

export function Text({
  variant = 'bodyMd',
  color = 'textPrimary',
  center,
  style,
  ...rest
}: TextProps) {
  const role = useRoleTheme();
  const resolvedColor =
    color === 'primary' || color === 'textLink' ? role.accent : colors[color];
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const weightFamily = weight != null ? FAMILY_FOR_WEIGHT[String(weight)] : undefined;

  return (
    <RNText
      style={[
        typography[variant],
        { color: resolvedColor },
        center && { textAlign: 'center' },
        style,
        weightFamily && { fontFamily: weightFamily, fontWeight: 'normal' },
      ]}
      {...rest}
    />
  );
}
