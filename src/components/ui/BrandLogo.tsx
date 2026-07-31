/**
 * BrandLogo — Comly's app mark: a gradient "squircle" (violet → green, nodding
 * to brand + trust) with a white location glyph, optionally paired with the
 * wordmark. Used on splash, onboarding, and About.
 */

import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';
import { Text } from './Text';

export interface BrandLogoProps {
  size?: number;
  wordmark?: boolean;
  /** Render the wordmark in white (for dark/gradient backgrounds). */
  onDark?: boolean;
  style?: ViewStyle;
}

const MARK_GRADIENT = ['#7c3aed', '#16a34a'] as const; // violet → green

export function BrandLogo({
  size = 56,
  wordmark = false,
  onDark = false,
  style,
}: BrandLogoProps) {
  const tile = {
    width: size,
    height: size,
    borderRadius: size * 0.32, // squircle-ish
  };

  const mark = (
    <LinearGradient
      colors={MARK_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, tile]}
    >
      <Ionicons name="location" size={size * 0.5} color={colors.white} />
    </LinearGradient>
  );

  if (!wordmark) return <View style={style}>{mark}</View>;

  return (
    <View style={[styles.row, style]}>
      {mark}
      <Text
        variant="headlineLg"
        color={onDark ? 'onPrimary' : 'primary'}
        style={[styles.word, { fontSize: size * 0.62 }]}
      >
        Comly
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { letterSpacing: -0.5 },
});
