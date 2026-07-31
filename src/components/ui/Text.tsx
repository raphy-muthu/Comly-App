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

import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors, typography, TypographyVariant } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';

type ColorKey = keyof typeof colors;

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

  return (
    <RNText
      style={[
        typography[variant],
        { color: resolvedColor },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}
