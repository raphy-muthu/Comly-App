/**
 * SafetyBadge — surfaces a job's teen-safety tier (5 levels) in the feed and on
 * detail screens. Success = teen safe, warning = caution/supervision,
 * danger = 18+/blocked.
 */

import { Chip } from '@/components/ui/Chip';
import { SafetyTier, SAFETY_TIERS } from '@/types/domain';

export interface SafetyBadgeProps {
  tier: SafetyTier;
}

const ICONS: Record<SafetyTier, string> = {
  teen_safe: 'shield-checkmark-outline',
  caution: 'alert-circle-outline',
  adult_supervision: 'people-outline',
  eighteen_plus_only: 'warning-outline',
  blocked: 'ban-outline',
};

export function SafetyBadge({ tier }: SafetyBadgeProps) {
  const { label, tone } = SAFETY_TIERS[tier];
  return <Chip label={label} tone={tone} icon={ICONS[tier] as any} />;
}
