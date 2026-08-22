/**
 * Job Detail — full listing view. Adapts to the viewer:
 *   • Owner  → "View Applications (N)"
 *   • Helper → "Apply for Job"
 *
 * The location preview is intentionally coarse ("Exact address hidden until
 * accepted"), reflecting the trust/safety model.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Rating,
  Text,
  useToast,
} from '@/components/ui';
import { SafetyBadge, TrustBadge, EquipmentBadge, PremiumBadge } from '@/components/trust';
import { ContactCard } from '@/components/job/ContactCard';
import { JobOwnerMenu } from '@/components/job/JobOwnerMenu';
import { MapPreview } from '@/components/job/MapPreview';
import {
  useConfirmJobCompletion,
  useDisputeJobCompletion,
  useJob,
  useJobContact,
  useJobReviews,
} from '@/hooks';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { useAuthStore } from '@/stores/authStore';
import {
  boostActive,
  eligibilityFor,
  categoryLabel,
  JOB_CATEGORIES,
  JOB_STATUS_LABELS,
} from '@/types/domain';
import { formatPay } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'JobDetail'>;

export function JobDetailScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id;
  const { data: job, isLoading } = useJob(params.jobId);
  const { data: jobReviews } = useJobReviews(params.jobId);
  const confirmCompletion = useConfirmJobCompletion();
  const disputeCompletion = useDisputeJobCompletion();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const isOwner = !!job && job.customerId === currentUserId;
  const isAcceptedHelper =
    !!job && !!job.assignedHelperId && job.assignedHelperId === currentUserId;

  // Contact unlock: the backend returns the OTHER party's card only to the
  // matched pair (privileged RPC in production — never a raw profile read).
  const { data: contactPerson } = useJobContact(
    params.jobId,
    !!job?.contactUnlockedAt && (isOwner || isAcceptedHelper)
  );

  if (isLoading || !job) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text variant="bodyMd" color="textSecondary">
            {isLoading ? 'Loading…' : 'Job not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const alreadyReviewed = (jobReviews ?? []).some(
    (r) => r.reviewerId === currentUserId
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        onBack={() => navigation.goBack()}
        onMenu={isOwner ? () => setMenuOpen(true) : undefined}
      />

      {isOwner && (
        <JobOwnerMenu
          job={job}
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEdit={() => navigation.navigate('EditJob', { jobId: job.id })}
          onReportNoShow={() =>
            navigation.navigate('ReportNoShow', { jobId: job.id })
          }
          onDeleted={() => navigation.goBack()}
        />
      )}

      <ScrollView
        style={styles.scrollWrap}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact unlocked after acceptance — visible only to the two parties */}
        {contactPerson && (isOwner || isAcceptedHelper) && (
          <ContactCard
            person={contactPerson}
            roleLabel={isOwner ? 'Your helper' : 'Job poster'}
          />
        )}

        {/* Completion confirmation — the helper's half of marking a job done.
            The customer requests it; nothing finalizes until this is answered. */}
        {isAcceptedHelper && job.status === 'pending_confirmation' && (
          <Card padded style={styles.completionCard}>
            <View style={styles.aiRow}>
              <Ionicons name="checkmark-done-circle" size={18} color={colors.warning} />
              <Text variant="labelMd" color="warning" style={{ marginLeft: 6 }}>
                Is this job finished?
              </Text>
            </View>
            <Text variant="bodyMd" color="textSecondary">
              {job.customer.name} marked this complete. Confirm and you can both
              leave reviews — or say it isn't done yet.
            </Text>
            {disputing ? (
              <>
                <Input
                  placeholder="What's still outstanding?"
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  multiline
                  numberOfLines={3}
                  style={styles.disputeInput}
                  containerStyle={styles.completionField}
                />
                <View style={styles.completionActions}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    size="md"
                    style={styles.completionBtn}
                    onPress={() => {
                      setDisputing(false);
                      setDisputeReason('');
                    }}
                  />
                  <Button
                    title="Send"
                    size="md"
                    style={styles.completionBtn}
                    loading={disputeCompletion.isPending}
                    disabled={disputeReason.trim().length < 5}
                    onPress={() =>
                      disputeCompletion.mutate(
                        { jobId: job.id, reason: disputeReason.trim() },
                        {
                          onSuccess: () => {
                            setDisputing(false);
                            setDisputeReason('');
                            toast.info("Sent — the job is back to in progress.");
                          },
                          onError: (e) =>
                            toast.error(
                              e instanceof Error ? e.message : 'Could not send that.'
                            ),
                        }
                      )
                    }
                  />
                </View>
              </>
            ) : (
              <View style={styles.completionActions}>
                <Button
                  title="Not done yet"
                  variant="secondary"
                  size="md"
                  style={styles.completionBtn}
                  onPress={() => setDisputing(true)}
                />
                <Button
                  title="Confirm complete"
                  size="md"
                  style={styles.completionBtn}
                  loading={confirmCompletion.isPending}
                  onPress={() =>
                    confirmCompletion.mutate(job.id, {
                      onSuccess: () =>
                        toast.success('Confirmed — leave a review to finish up.'),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : 'Failed.'),
                    })
                  }
                />
              </View>
            )}
          </Card>
        )}

        {isOwner && job.status === 'pending_confirmation' && (
          <Card padded style={styles.completionCard}>
            <View style={styles.aiRow}>
              <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
              <Text variant="labelMd" color="warning" style={{ marginLeft: 6 }}>
                Waiting on your helper
              </Text>
            </View>
            <Text variant="bodyMd" color="textSecondary">
              They need to confirm the work is finished. Reviews open for both of
              you once they do.
            </Text>
          </Card>
        )}

        {/* Reviews open to both parties once the job is genuinely complete. */}
        {job.status === 'completed' && (isOwner || isAcceptedHelper) && (
          <Card padded style={styles.reviewCard}>
            <View style={styles.aiRow}>
              <Ionicons name="star" size={18} color={colors.tertiary} />
              <Text variant="labelMd" color="tertiary" style={{ marginLeft: 6 }}>
                Job complete
              </Text>
            </View>
            {alreadyReviewed ? (
              <Text variant="bodyMd" color="textSecondary">
                Thanks — your review is posted.
              </Text>
            ) : (
              <>
                <Text variant="bodyMd" color="textSecondary">
                  Leave a review for {isOwner ? 'your helper' : 'the customer'}.
                  Reviews are how neighbors decide who to trust.
                </Text>
                <Button
                  title="Leave a Review"
                  icon="star-outline"
                  size="md"
                  style={styles.reviewBtn}
                  onPress={() => navigation.navigate('LeaveReview', { jobId: job.id })}
                />
              </>
            )}
          </Card>
        )}

        <Card rounded="xl" padded style={styles.headerCard}>
          <View style={styles.categoryRow}>
            <Chip
              label={categoryLabel(job.category, job.customCategoryText)}
              icon={JOB_CATEGORIES[job.category].icon as any}
              tone="primary"
            />
            <SafetyBadge tier={job.safetyTier} />
          </View>
          {isOwner && job.status !== 'open' && (
            <View style={styles.badgeRow}>
              <Chip
                label={JOB_STATUS_LABELS[job.status]}
                tone={job.status === 'accepted' || job.status === 'completed' ? 'success' : 'neutral'}
              />
            </View>
          )}
          <View style={styles.badgeRow}>
            <EquipmentBadge status={job.equipmentStatus} />
            {job.communityTags.length > 0 && (
              <Chip label={`${job.communityTags.length} community tag${job.communityTags.length > 1 ? 's' : ''}`} tone="success" />
            )}
          </View>
          <Text variant="headlineLgMobile" style={styles.title}>
            {job.title}
          </Text>
          <View style={styles.metaWrap}>
            <Meta icon="cash-outline" text={formatPay(job.pay, job.payType)} highlight />
            <Meta icon="location-outline" text={`${job.distanceMiles.toFixed(1)} mi`} />
            <Meta icon="calendar-outline" text={job.scheduledFor} />
            <Meta icon="time-outline" text={job.estimatedDuration} />
          </View>
        </Card>

        <Card padded style={styles.block}>
          <Text variant="labelMd" color="textSecondary" style={styles.blockLabel}>
            DESCRIPTION
          </Text>
          <Text variant="bodyLg" color="textPrimary">
            {job.description}
          </Text>
        </Card>

        {/* Location preview (coarse) */}
        <Card padded style={styles.block}>
          <View style={styles.mapHeader}>
            <Ionicons name="map-outline" size={16} color={role.accent} />
            <Text variant="labelMd" color="textSecondary" style={{ marginLeft: 6 }}>
              LOCATION PREVIEW ({job.neighborhood})
            </Text>
          </View>
          <MapPreview
            lat={job.location.lat}
            lng={job.location.lng}
            neighborhood={job.neighborhood}
          />
        </Card>

        {/* Customer */}
        <Card padded style={styles.block}>
          <View style={styles.customerRow}>
            <Avatar uri={job.customer.avatarUrl} name={job.customer.name} size={48} />
            <View style={styles.customerInfo}>
              <Text variant="bodyLg">{job.customer.name}</Text>
              <Rating
                value={job.customer.rating}
                count={job.customer.jobsCount}
                countLabel="jobs posted"
              />
            </View>
          </View>
          <View style={styles.trustRow}>
            <TrustBadge trusted={job.customer.isTrusted} label="Trusted Customer" />
            {job.customer.isCustomerPlus && <PremiumBadge kind="customer_plus" />}
            {boostActive(job) && <PremiumBadge kind="boosted" />}
          </View>
        </Card>

        {/* AI pay insight */}
        <Card padded style={styles.aiCard}>
          <View style={styles.aiRow}>
            <Ionicons name="trending-up" size={18} color={colors.secondary} />
            <Text variant="labelMd" color="secondary" style={{ marginLeft: 6 }}>
              AI Pay Insight
            </Text>
          </View>
          <Text variant="bodyMd" color="textSecondary">
            This job is priced at the local average for{' '}
            {JOB_CATEGORIES[job.category].label.toLowerCase()} in your area.
          </Text>
        </Card>

        {/* Safety */}
        <Card padded style={styles.safetyCard}>
          <View style={styles.aiRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.warning} />
            <Text variant="labelMd" color="warning" style={{ marginLeft: 6 }}>
              Safety First
            </Text>
          </View>
          <Text variant="bodyMd" color="textSecondary">
            Meet in a safe place. Exact contact details are unlocked after
            acceptance.
          </Text>
        </Card>

        {isAcceptedHelper &&
          ['accepted', 'in_progress', 'pending_confirmation'].includes(job.status) && (
            <Button
              title="Report a no-show"
              variant="ghost"
              icon="person-remove-outline"
              size="sm"
              onPress={() => navigation.navigate('ReportNoShow', { jobId: job.id })}
            />
          )}

        {!isOwner && (
          <Button
            title="Report listing"
            variant="ghost"
            icon="flag-outline"
            size="sm"
            onPress={() =>
              navigation.navigate('Report', {
                jobId: job.id,
                reportedUserId: job.customerId,
              })
            }
          />
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {isOwner ? (
          <Button
            title={`View Applications (${job.applicantsCount})`}
            onPress={() =>
              navigation.navigate('JobApplications', { jobId: job.id })
            }
          />
        ) : isAcceptedHelper ? (
          <Button
            title={
              job.status === 'completed' ? 'Job complete' : "You're hired for this job"
            }
            icon="checkmark-circle"
            disabled
          />
        ) : (
          (() => {
            const elig = eligibilityFor(
              job.safetyTier,
              user?.ageGroup ?? 'adult',
              user?.verification.parentApproved ?? false
            );
            return (
              <>
                {!elig.canApply && (
                  <Text variant="caption" color="danger" center style={styles.eligReason}>
                    {elig.reason}
                  </Text>
                )}
                <Button
                  title={elig.canApply ? 'Apply for Job' : 'Not eligible'}
                  icon={elig.canApply ? undefined : 'lock-closed'}
                  disabled={!elig.canApply}
                  onPress={() => navigation.navigate('ApplyToJob', { jobId: job.id })}
                />
              </>
            );
          })()
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack, onMenu }: { onBack: () => void; onMenu?: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-back" onPress={onBack} />
      <Text variant="headlineMd" color="primary">
        Comly
      </Text>
      {onMenu ? (
        <IconButton
          icon="ellipsis-horizontal"
          onPress={onMenu}
          accessibilityLabel="Manage listing"
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

function Meta({
  icon,
  text,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons
        name={icon}
        size={15}
        color={highlight ? colors.secondary : colors.outline}
      />
      <Text
        variant="labelMd"
        color={highlight ? 'secondary' : 'textSecondary'}
        style={{ marginLeft: 4 }}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  headerSpacer: { width: 40 },
  scrollWrap: { flex: 1, paddingHorizontal: spacing.marginMobile },
  scrollContent: { paddingBottom: spacing.lg },
  headerCard: { marginBottom: spacing.sm },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base, marginBottom: spacing.sm },
  eligReason: { marginBottom: spacing.base },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  block: { marginBottom: spacing.sm },
  blockLabel: { marginBottom: spacing.base },
  mapHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customerInfo: { flex: 1 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.base, marginTop: spacing.sm },
  aiCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoSoft,
  },
  aiRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  completionCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  completionActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  completionBtn: { flex: 1 },
  completionField: { marginTop: spacing.sm },
  disputeInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  reviewCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  reviewBtn: { marginTop: spacing.sm },
  safetyCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
