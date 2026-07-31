/**
 * Soft ambient shadows, faintly tinted with the brand violet for a premium,
 * airy feel. Larger blur + lower opacity than a stock drop shadow.
 *
 * iOS reads the shadow* props; Android uses `elevation`. We provide both so
 * cards look consistent across platforms.
 */

import { Platform, ViewStyle } from 'react-native';
import { palette } from './colors';

const make = (
  y: number,
  blur: number,
  opacity: number,
  elevation: number
): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: palette.primaryContainer, // violet tint
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
    },
    android: {
      elevation,
      shadowColor: palette.primaryContainer,
    },
    default: {},
  }) as ViewStyle;

export const shadows = {
  // Level 1 — cards / surfaces (soft, diffuse)
  card: make(8, 28, 0.07, 3),
  // Level 2 — modals / floating / interactive
  floating: make(12, 36, 0.12, 10),
  // Subtle hairline for chips
  subtle: make(3, 12, 0.05, 1),
  none: {} as ViewStyle,
} as const;

export type ShadowToken = keyof typeof shadows;
