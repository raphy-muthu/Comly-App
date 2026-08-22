/**
 * Leave a Review — the "both ends" feedback screen.
 *
 * Reachable by either party of a completed job, and it works out who is being
 * reviewed from the job itself rather than taking it as a route param: the
 * customer reviews the accepted helper, the helper reviews the customer.
 * Anything else would let a caller point a review at an arbitrary user id.
 *
 * The backend re-checks all of this (see migration 0013's reviews policy) —
 * these guards exist so the UI is honest, not because they're the boundary.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Button, Card, IconButton, Input, Text, useToast } from '@/components/ui';
import { useCreateReview, useJob, useJobReviews } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { ReviewCategory } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'LeaveReview'>;

const CATEGORIES: { key: ReviewCategory; label: string; hint: string }[] = [
  { key: 'reliability', label: 'Reliability', hint: 'Showed up when they said they would' },
  { key: 'quality', label: 'Quality of work', hint: 'The job was done well' },
  { key: 'communication', label: 'Communication', hint: 'Easy to reach and clear' },
  { key: 'professionalism', label: 'Professionalism', hint: 'Respectful and considerate' },
];

const DEFAULT_RATINGS: Record<ReviewCategory, number> = {
  reliability: 0,
  quality: 0,
  communication: 0,
  professionalism: 0,
};

export function LeaveReviewScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const { data: job, isLoading } = useJob(params.jobId);
  const { data: jobReviews } = useJobReviews(params.jobId);
  const createReview = useCreateReview();
  const toast = useToast();

  const [ratings, setRatings] = useState<Record<ReviewCategory, number>>(DEFAULT_RATINGS);
  const [comment, setComment] = useState('');

  const isOwner = !!job && !!user && job.customerId === user.id;
  const isHelper = !!job && !!user && job.assignedHelperId === user.id;

  // Derived, never taken from the route: the counterparty on this specific job.
  const revieweeId = isOwner ? job?.assignedHelperId : isHelper ? job?.customerId : undefined;
  const revieweeName = isOwner ? 'your helper' : 'the customer';

  const alreadyReviewed = useMemo(
    () => (jobReviews ?? []).some((r) => r.reviewerId === user?.id),
    [jobReviews, user?.id]
  );

  const scored = Object.values(ratings).filter((v) => v > 0).length;
  const canSubmit =
    !!revieweeId && job?.status === 'completed' && !alreadyReviewed && scored === CATEGORIES.length;

  const submit = () => {
    if (!revieweeId) return;
    createReview.mutate(
      { jobId: params.jobId, revieweeId, ratings, comment: comment.trim() },
      {
        onSuccess: () => {
          toast.success('Review posted — thanks for helping neighbors trust each other.');
          navigation.goBack();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not post that review.'),
      }
    );
  };

  const blockedReason = (() => {
    if (isLoading || !job) return null;
    if (!isOwner && !isHelper) return 'Only the two people on a job can review it.';
    if (job.status !== 'completed')
      return 'Reviews open once both sides confirm the job is complete.';
    if (!revieweeId) return 'This job never had an accepted helper.';
    if (alreadyReviewed) return 'You already left a review for this job.';
    return null;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Leave a Review</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading || !job ? (
          <Text variant="bodyMd" color="textSecondary">
            {isLoading ? 'Loading…' : 'Job not found.'}
          </Text>
        ) : (
          <>
            <Card padded style={styles.jobCard}>
              <Text variant="bodyLg" numberOfLines={2}>
                {job.title}
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.jobMeta}>
                How did it go with {revieweeName}?
              </Text>
            </Card>

            {blockedReason ? (
              <Card padded style={styles.blockedCard}>
                <View style={styles.blockedRow}>
                  <Ionicons name="lock-closed" size={18} color={colors.outline} />
                  <Text variant="bodyMd" color="textSecondary" style={styles.blockedText}>
                    {blockedReason}
                  </Text>
                </View>
              </Card>
            ) : (
              <>
                {CATEGORIES.map((c) => (
                  <View key={c.key} style={styles.category}>
                    <Text variant="labelMd" color="textSecondary">
                      {c.label.toUpperCase()}
                    </Text>
                    <Text variant="caption" color="outline" style={styles.hint}>
                      {c.hint}
                    </Text>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.label}: ${n} of 5`}
                          onPress={() =>
                            setRatings((prev) => ({ ...prev, [c.key]: n }))
                          }
                        >
                          <Ionicons
                            name={ratings[c.key] >= n ? 'star' : 'star-outline'}
                            size={30}
                            color={ratings[c.key] >= n ? colors.warning : colors.outlineVariant}
                            style={styles.star}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                <Input
                  label="Anything you'd tell another neighbor?"
                  placeholder="Arrived on time and cleared the whole driveway…"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={4}
                  style={styles.multiline}
                  optional
                  containerStyle={styles.field}
                />

                <Text variant="caption" color="outline" style={styles.policy}>
                  Reviews are public and permanent. Keep it about the work — a
                  safety concern belongs in a report, not a review.
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      {!blockedReason && (
        <View style={styles.footer}>
          <Button
            title={scored < CATEGORIES.length ? 'Rate all four to continue' : 'Post Review'}
            onPress={submit}
            disabled={!canSubmit}
            loading={createReview.isPending}
            style={{ backgroundColor: canSubmit ? role.accent : undefined }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  jobCard: { marginBottom: spacing.md },
  jobMeta: { marginTop: 4 },
  blockedCard: { marginBottom: spacing.md },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  blockedText: { flex: 1 },
  category: { marginBottom: spacing.md },
  hint: { marginTop: 2 },
  stars: { flexDirection: 'row', marginTop: spacing.base },
  star: { marginRight: spacing.base },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  policy: { marginBottom: spacing.md },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
