/**
 * JobCard — the large feed card used in the helper job feed and recommendation
 * lists: AI match ring, title, location/distance, pay, and a safety badge.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Card, Text } from '@/components/ui';
import { ScoreRing } from '@/components/trust';
import { SafetyBadge } from '@/components/trust/SafetyBadge';
import { EquipmentBadge } from '@/components/trust/EquipmentBadge';
import { PremiumBadge } from '@/components/trust/PremiumBadge';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { boostActive, eligibilityForUser, Job } from '@/types/domain';
import { useAuthStore } from '@/stores/authStore';
import { formatPayShort, postedAgo } from '@/lib/format';

export interface JobCardProps {
  job: Job;
  onPress: () => void;
  /** Hide the safety badge in tight layouts. */
  showSafety?: boolean;
}

export function JobCard({ job, onPress, showSafety = true }: JobCardProps) {
  const role = useRoleTheme();
  const user = useAuthStore((s) => s.user);
  // Teens see jobs they can't take, clearly labelled, rather than having them
  // hidden. The label has to be on the card itself: the tier badge says what
  // the job requires, this says what it means for the person looking. The
  // database refuses the application regardless.
  const eligibility = eligibilityForUser(job.safetyTier, user);
  return (
    // testID is what the Maestro flows select on. A feed card has no stable
    // text of its own — the title is seeded data that changes — so matching it
    // by text means matching an arbitrary regex against the whole screen.
    <Card onPress={onPress} rounded="xl" style={styles.card} testID="job-card">
      <View style={styles.row}>
        {job.matchScore !== undefined ? (
          // "How well this job fits you" — an AI match score, labelled so the
          // ring's percentage is self-explanatory.
          <View style={styles.matchCol}>
            <ScoreRing value={job.matchScore} suffix="%" size={52} />
            <Text variant="caption" color="textSecondary" style={styles.matchLabel}>
              match
            </Text>
          </View>
        ) : (
          <View style={[styles.iconBox, { backgroundColor: role.accentSoft }]}>
            <Ionicons name="briefcase-outline" size={22} color={role.accent} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="headlineMd" style={styles.title} numberOfLines={2}>
              {job.title}
            </Text>
            {showSafety && <SafetyBadge tier={job.safetyTier} />}
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.outline} />
            <Text variant="caption" color="textSecondary" style={styles.meta}>
              {job.neighborhood} · {job.distanceMiles.toFixed(1)} mi
            </Text>
          </View>

          {showSafety && (
            <View style={styles.tagRow}>
              <EquipmentBadge status={job.equipmentStatus} />
              {/* Says why this listing is near the top. Boost outranks the
                  plan badge, so only one shows. */}
              {boostActive(job) ? (
                <PremiumBadge kind="boosted" />
              ) : job.customer.isCustomerPlus ? (
                <PremiumBadge kind="customer_plus" />
              ) : null}
            </View>
          )}

          {!eligibility.canApply && (
            <View style={styles.ineligibleRow}>
              <Ionicons name="lock-closed" size={14} color={colors.error} />
              <Text variant="caption" color="danger" style={styles.ineligibleText}>
                You can't apply. {eligibility.reason}
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            <Text variant="headlineMd" color="secondary">
              {formatPayShort(job.pay, job.payType)}
            </Text>
            <Text variant="caption" color="outline">
              {postedAgo(job)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  matchCol: { alignItems: 'center', width: 52 },
  matchLabel: { marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  meta: { marginLeft: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base, marginTop: spacing.base },
  ineligibleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  ineligibleText: { flex: 1, marginLeft: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
});
