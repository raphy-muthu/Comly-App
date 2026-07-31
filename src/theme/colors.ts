/**
 * Comly color tokens — "Aurora" design system.
 *
 * A modern dual-tone identity for a neighborhood marketplace:
 *   • Violet  = brand / action (buttons, links, brand moments)
 *   • Green   = trust / verified / success (safety, verification, "hired")
 *   • Blue    = information (AI insights, tips)
 * Cool, faintly violet-tinted neutrals keep surfaces crisp and premium.
 *
 * Every component references the semantic aliases / tint tokens below, so the
 * whole app re-themes from this one file.
 */

export const palette = {
  // Surfaces — cool, near-white with a whisper of violet
  surface: '#f7f7fb',
  surfaceDim: '#dcdae2',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f2f7',
  surfaceContainer: '#ededf3',
  surfaceContainerHigh: '#e6e6ee',
  surfaceContainerHighest: '#e0e0e9',

  // Text / foreground
  onSurface: '#16141f',
  onSurfaceVariant: '#5a5666',
  inverseSurface: '#2a2732',
  inverseOnSurface: '#f3f1f7',

  // Outlines
  outline: '#7a7686',
  outlineVariant: '#d6d3df',

  // Primary — Violet (brand / action)
  primary: '#6d28d9',
  onPrimary: '#ffffff',
  primaryContainer: '#7c3aed',
  onPrimaryContainer: '#ede9fe',
  inversePrimary: '#c4b5fd',
  surfaceTint: '#7c3aed',

  // Secondary — Blue (information)
  secondary: '#2563eb',
  onSecondary: '#ffffff',
  secondaryContainer: '#93c5fd',
  onSecondaryContainer: '#1e3a8a',

  // Tertiary — Green (trust / verified / success)
  tertiary: '#15803d',
  onTertiary: '#ffffff',
  tertiaryContainer: '#16a34a',
  onTertiaryContainer: '#dcfce7',

  // Error
  error: '#dc2626',
  onError: '#ffffff',
  errorContainer: '#fee2e2',
  onErrorContainer: '#7f1d1d',

  // Background
  background: '#f7f7fb',
  onBackground: '#16141f',

  // Utility
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

/**
 * Gradients — applied to high-impact brand moments (CTAs, hero cards, splash).
 * 135° top-left → bottom-right; consumers pass start/end coords.
 */
export const gradients = {
  brand: ['#8b5cf6', '#6d28d9'] as const, // vivid violet — primary CTAs / hero
  brandDeep: ['#6d28d9', '#4c1d95'] as const, // deep violet — splash
  leaf: ['#22c55e', '#15803d'] as const, // fresh green — AI assistant / success moments
} as const;

/**
 * Semantic aliases + soft tint tokens. Prefer these in components so the brand
 * hue can shift from one place. `*Soft` tokens are the pale fills used for icon
 * wells, chips, and info cards.
 */
export const colors = {
  ...palette,

  // Semantic text
  textPrimary: palette.onSurface,
  textSecondary: palette.onSurfaceVariant,
  textInverse: palette.inverseOnSurface,
  textLink: palette.primaryContainer, // links read as brand violet

  // Status
  success: palette.tertiaryContainer,
  successText: palette.tertiary,
  warning: '#b45309', // amber-700 — ratings, adult supervision
  warningContainer: '#fef3c7',
  danger: palette.error,

  // Soft tints (pale fills for icon wells / chips / info cards)
  brandSoft: '#ede9fe', // violet-100
  successSoft: '#dcfce7', // green-100
  infoSoft: '#dbeafe', // blue-100
  warningSoft: '#fef3c7', // amber-100
  dangerSoft: '#fee2e2', // red-100

  // Component surfaces
  card: palette.surfaceContainerLowest,
  inputBackground: palette.surfaceContainerLow,
  border: palette.outlineVariant,
  divider: palette.surfaceContainerHigh,
} as const;

export type ColorToken = keyof typeof colors;
