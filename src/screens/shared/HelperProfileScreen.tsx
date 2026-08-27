/**
 * Helper Profile — read-only view of another neighbor: identity, reputation,
 * verification ladder, and reviews. Reached from recommendations and
 * applications.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  Rating,
  Text,
} from '@/components/ui';
import {
  BadgeRow,
  ScoreRing,
  TrustBadge,
  VerificationList,
  YouthSkillsCard,
} from '@/components/trust';
import { useProfile, useUserReviews } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { NO_SHOW_POLICY, Review, ReviewCategory } from '@/types/domain';
import { timeAgo } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'HelperProfile'>;

const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  reliability: 'Reliability',
  quality: 'Quality',
  communication: 'Communication',
  professionalism: 'Professionalism',
};

export function HelperProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { data: profile, isLoading } = useProfile(params.userId);
  const { data: reviews } = useUserReviews(params.userId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = params.userId === currentUserId;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || !profile ? (
        <View style={styles.center}>
          <Text variant="bodyMd" color="textSecondary">
            {isLoading ? 'Loading…' : 'Profile not found.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <Card padded style={styles.identity}>
            <Avatar uri={profile.avatarUrl} name={profile.name} size={72} />
            <Text variant="headlineMd" style={styles.name}>
              {profile.name}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.outline} />
              <Text variant="bodyMd" color="textSecondary" style={{ marginLeft: 4 }}>
                {profile.neighborhood}
              </Text>
            </View>
            <View style={styles.identityMeta}>
              <Rating value={profile.rating} count={profile.jobsCount} />
              <TrustBadge trusted={profile.isTrusted} />
            </View>
            {profile.bio && (
              <Text variant="bodyMd" color="textSecondary" center style={styles.bio}>
                {profile.bio}
              </Text>
            )}
            <View style={styles.badges}>
              <BadgeRow profile={profile} />
            </View>
          </Card>

          {isSelf && (
            <Card padded style={styles.previewNote}>
              <View style={styles.previewRow}>
                <Ionicons name="eye-outline" size={16} color={colors.secondary} />
                <Text variant="caption" color="textSecondary" style={styles.previewText}>
                  This is your public profile — exactly what neighbors see.
                  Private details (phone, family contacts) are never shown here.
                </Text>
              </View>
            </Card>
          )}

          {/* Reliability caution. Only at the warning threshold — surfacing a
              single confirmed strike publicly would let one bad report do
              disproportionate damage. */}
          {profile.strikes >= NO_SHOW_POLICY.warningThreshold && (
            <Card padded style={styles.strikeCard}>
              <View style={styles.previewRow}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <Text variant="caption" color="textSecondary" style={styles.previewText}>
                  This neighbor has {profile.strikes} confirmed no-shows. Consider
                  confirming plans before the job.
                </Text>
              </View>
            </Card>
          )}

          {/* Reputation */}
          <Card padded style={styles.block}>
            <View style={styles.repRow}>
              <ScoreRing value={profile.reputationScore} size={64} strokeWidth={6} />
              <View style={styles.repInfo}>
                <Text variant="bodyLg" style={{ fontWeight: '700' }}>
                  Reputation Score
                </Text>
                <Text variant="caption" color="textSecondary">
                  Based on reviews, completion rate, response speed, account age,
                  and verification.
                </Text>
              </View>
            </View>
          </Card>

          {/* Youth skills */}
          {profile.roles.includes('helper') && (
            <View style={styles.block}>
              <YouthSkillsCard profile={profile} canGenerate={isSelf} />
            </View>
          )}

          {/* Verification */}
          <View style={styles.block}>
            <Text variant="headlineMd" style={styles.sectionTitle}>
              Verification
            </Text>
            <Card padded>
              <VerificationList
                status={profile.verification}
                hide={
                  profile.ageGroup === 'adult'
                    ? ['schoolEmailVerified', 'parentApproved']
                    : []
                }
              />
            </Card>
          </View>

          {/* Reviews */}
          <View style={styles.block}>
            <Text variant="headlineMd" style={styles.sectionTitle}>
              Reviews ({reviews?.length ?? 0})
            </Text>
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <Card padded>
                <Text variant="bodyMd" color="textSecondary">
                  No reviews yet.
                </Text>
              </Card>
            )}
          </View>

          {!isSelf && (
            <Button
              title="Report this profile"
              variant="ghost"
              size="sm"
              icon="flag-outline"
              onPress={() =>
                navigation.navigate('Report', { reportedUserId: params.userId })
              }
              style={styles.reportBtn}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const avg =
    Object.values(review.ratings).reduce((a, b) => a + b, 0) /
    Object.values(review.ratings).length;

  return (
    <Card padded style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Rating value={avg} />
        <Text variant="caption" color="outline">
          {timeAgo(review.createdAt)}
        </Text>
      </View>
      <Text variant="bodyMd" color="textPrimary" style={styles.reviewComment}>
        “{review.comment}”
      </Text>
      <Divider spacingY={spacing.sm} />
      <View style={styles.categoryGrid}>
        {(Object.keys(review.ratings) as ReviewCategory[]).map((cat) => (
          <View key={cat} style={styles.categoryItem}>
            <Text variant="caption" color="textSecondary">
              {CATEGORY_LABELS[cat]}
            </Text>
            <View style={styles.categoryScore}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text variant="labelMd" style={{ marginLeft: 2 }}>
                {review.ratings[cat].toFixed(1)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  identity: { alignItems: 'center' },
  name: { marginTop: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  identityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bio: { marginTop: spacing.sm },
  badges: { marginTop: spacing.sm, alignItems: 'center' },
  strikeCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  previewNote: {
    marginTop: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoSoft,
  },
  previewRow: { flexDirection: 'row', gap: spacing.base },
  previewText: { flex: 1 },
  reportBtn: { marginTop: spacing.md },
  block: { marginTop: spacing.md },
  sectionTitle: { marginBottom: spacing.sm },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  repInfo: { flex: 1 },
  reviewCard: { marginBottom: spacing.sm },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewComment: { marginTop: spacing.base, fontStyle: 'italic' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryItem: { width: '40%' },
  categoryScore: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
