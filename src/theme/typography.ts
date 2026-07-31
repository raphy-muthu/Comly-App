/**
 * Typography scale — Plus Jakarta Sans across all levels.
 *
 * Font family strings match the exports from
 * `@expo-google-fonts/plus-jakarta-sans`. Fonts are loaded in App.tsx via
 * useFonts(); until they load we fall back to the system font.
 */

import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Named text styles from the Organic Vitality system. Mobile-tuned variants are
 * used by default where the design provides them.
 */
export const typography = {
  displayLg: {
    fontFamily: fontFamily.extrabold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96, // -0.02em
  },
  headlineLg: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.32, // -0.01em
  },
  headlineLgMobile: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  headlineMd: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 32,
  },
  bodyLg: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  labelMd: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.7, // 0.05em
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
