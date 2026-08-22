/**
 * PremiumBadge — the visible half of Comly's premium tiers.
 *
 * Premium on Comly is visibility only: it changes where something sorts, never
 * whether it appears. That makes the badge load-bearing rather than decorative
 * — it's the explanation for why a listing or application is at the top, so it
 * always renders alongside the thing that got promoted.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

export type PremiumKind = 'boosted' | 'customer_plus' | 'helper_pro';

const KINDS: Record<
  PremiumKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }
> = {
  boosted: {
    label: 'Boosted',
    icon: 'trending-up',
    tint: colors.warning,
    bg: colors.warningContainer,
  },
  customer_plus: {
    label: 'Comly Plus',
    icon: 'star',
    tint: colors.warning,
    bg: colors.warningContainer,
  },
  helper_pro: {
    label: 'Pro Helper',
    icon: 'ribbon',
    tint: colors.tertiary,
    bg: colors.successSoft,
  },
};

export interface PremiumBadgeProps {
  kind: PremiumKind;
  /** Overrides the default label, e.g. an explicit priority reason. */
  label?: string;
}

export function PremiumBadge({ kind, label }: PremiumBadgeProps) {
  const spec = KINDS[kind];
  return (
    <View style={[styles.badge, { backgroundColor: spec.bg }]}>
      <Ionicons name={spec.icon} size={12} color={spec.tint} />
      <Text variant="caption" style={[styles.label, { color: spec.tint }]}>
        {label ?? spec.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  label: { marginLeft: 4, fontWeight: '600' },
});
