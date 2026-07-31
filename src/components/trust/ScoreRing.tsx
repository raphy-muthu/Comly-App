/**
 * ScoreRing — circular progress used for reputation/trust scores and AI match
 * percentages (e.g. the "98%" rings in the helper job feed). Defaults to the
 * active role's accent (violet for customers, green for helpers); pass `color`
 * to override.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from '@/components/ui/Text';

export interface ScoreRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Show "%" suffix (match score) vs. bare number (trust score). */
  suffix?: string;
  color?: string;
}

export function ScoreRing({
  value,
  size = 56,
  strokeWidth = 5,
  suffix = '',
  color,
}: ScoreRingProps) {
  const role = useRoleTheme();
  const ringColor = color ?? role.accent;
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceContainerHigh}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text
          variant="labelMd"
          style={{ color: ringColor, fontSize: size * 0.26 }}
        >
          {Math.round(clamped)}
          {suffix}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
