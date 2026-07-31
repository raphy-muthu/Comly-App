/**
 * HeroCard — the gradient promo card at the top of the dashboards ("Need help
 * today?", "Today's Opportunity"). Tints to the active role (violet for
 * customers, green for helpers). Renders a title, subtitle, optional CTA.
 */

import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from './Text';

export interface HeroCardProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  style?: ViewStyle;
}

export function HeroCard({
  title,
  subtitle,
  eyebrow,
  ctaLabel,
  onPressCta,
  style,
}: HeroCardProps) {
  const role = useRoleTheme();
  return (
    <LinearGradient
      colors={role.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {eyebrow && (
        <Text variant="labelMd" style={styles.eyebrow}>
          {eyebrow.toUpperCase()}
        </Text>
      )}
      <Text variant="headlineMd" color="onPrimary" style={styles.title}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="bodyMd" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {ctaLabel && onPressCta && (
        <Pressable
          onPress={onPressCta}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text variant="labelMd" style={{ color: role.accent }}>
            {ctaLabel}
          </Text>
        </Pressable>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  title: { marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginBottom: spacing.md },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  ctaPressed: { opacity: 0.9 },
});
