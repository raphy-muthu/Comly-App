/**
 * BadgeRow — the earned-badge chips on a profile (Top Rated, Parent Approved,
 * Trusted Neighbor, …), derived from the profile's track record.
 */

import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { spacing } from '@/theme';
import { BADGES, BadgeKey, deriveBadges, UserProfile } from '@/types/domain';

export interface BadgeRowProps {
  profile: Pick<
    UserProfile,
    'rating' | 'jobsCount' | 'reputationScore' | 'ageGroup' | 'verification'
  >;
  /** Cap how many badges render (profiles can earn a lot). */
  max?: number;
}

const TONE: Record<BadgeKey, 'success' | 'info' | 'warning' | 'primary'> = {
  parent_approved: 'success',
  teen_safe_helper: 'info',
  top_rated: 'warning',
  fast_responder: 'info',
  reliable_helper: 'success',
  community_builder: 'primary',
  skill_builder: 'info',
  trusted_neighbor: 'success',
};

export function BadgeRow({ profile, max = 6 }: BadgeRowProps) {
  const badges = deriveBadges(profile).slice(0, max);
  if (badges.length === 0) return null;

  return (
    <View style={styles.row}>
      {badges.map((key) => (
        <Chip
          key={key}
          label={BADGES[key].label}
          icon={BADGES[key].icon as any}
          tone={TONE[key]}
          style={styles.chip}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginRight: spacing.base, marginBottom: spacing.base },
});
