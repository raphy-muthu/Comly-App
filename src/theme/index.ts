/**
 * Comly theme — single import surface for all design tokens.
 *
 *   import { theme } from '@/theme';
 *   ...style={{ color: theme.colors.primary }}
 */

export { colors, palette, gradients } from './colors';
export type { ColorToken } from './colors';

export { typography, fontFamily } from './typography';
export type { TypographyVariant } from './typography';

export { spacing, radius } from './spacing';
export type { SpacingToken, RadiusToken } from './spacing';

export { shadows } from './shadows';
export type { ShadowToken } from './shadows';

export { getRoleTheme } from './roles';
export type { RoleTheme } from './roles';

import { colors, gradients } from './colors';
import { typography, fontFamily } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';

export const theme = {
  colors,
  gradients,
  typography,
  fontFamily,
  spacing,
  radius,
  shadows,
} as const;

export type Theme = typeof theme;