/**
 * Spacing, radius, and layout tokens — fluid 8px grid.
 */

export const spacing = {
  none: 0,
  xs: 4,
  sm: 12,
  base: 8,
  md: 24,
  lg: 40,
  xl: 64,
  // Layout
  marginMobile: 16, // screen side margins
  gutter: 20,
  containerMax: 1200,
} as const;

/** Corner radii — squircle-leaning. */
export const radius = {
  sm: 4,
  base: 8, // inputs, small buttons
  md: 12,
  lg: 16, // feed cards / feature modules
  xl: 24, // large marketplace cards
  full: 9999, // pills / primary CTAs
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
