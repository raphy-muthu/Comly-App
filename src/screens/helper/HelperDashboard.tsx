/**
 * Helper Dashboard — opportunity hero, a 2×2 stats grid (jobs completed, rating,
 * trust score, weekly matches), and recommended jobs.
 *
 * Note: no earnings tile — payment is handled off-app, so we surface reputation
 * and activity metrics instead.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing } from '@/theme';
import {
  Avatar,
  HeroCard,
  IconButton,
  Screen,
  SectionHeader,
  StatTile,
  Text,
} from '@/components/ui';
import { JobCard } from '@/components/job/JobCard';
import { useFeedJobs } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function HelperDashboard() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { data: jobs } = useFeedJobs();

  const firstName = user?.name.split(' ')[0] ?? 'there';
  const matchCount = jobs?.length ?? 0;

  return (
    <Screen scroll>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={16} color={colors.tertiaryContainer} />
          <Text variant="labelMd" color="tertiary" style={styles.locationText}>
            {user?.neighborhood ?? 'Your area'}
          </Text>
        </View>
        <View style={styles.topRight}>
          <IconButton
            icon="notifications-outline"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Alerts' })}
          />
          <Pressable
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={6}
          >
            <Avatar uri={user?.avatarUrl} name={user?.name} size={36} />
          </Pressable>
        </View>
      </View>

      <Text variant="headlineLgMobile" style={styles.greeting}>
        Hi, {firstName}
      </Text>

      <HeroCard
        eyebrow="Today's Opportunity"
        title={`${matchCount} jobs match your skills today`}
        ctaLabel="View Matches"
        onPressCta={() => navigation.navigate('MainTabs', { screen: 'Jobs' })}
        style={styles.hero}
      />

      {/* Stats grid */}
      <View style={styles.statsRow}>
        <StatTile
          icon="checkmark-done-outline"
          value={String(user?.jobsCount ?? 0)}
          label="Jobs Completed"
          tone="primary"
        />
        <StatTile
          icon="star-outline"
          value={(user?.rating ?? 0).toFixed(1)}
          label="Avg Rating"
          tone="warning"
        />
      </View>
      <View style={styles.statsRow}>
        <StatTile
          icon="shield-checkmark-outline"
          value={String(user?.reputationScore ?? 0)}
          label="Trust Score"
          tone="secondary"
        />
        <StatTile
          icon="sparkles-outline"
          value={String(matchCount)}
          label="New Matches"
          tone="tertiary"
          caption="This Week"
        />
      </View>

      {/* Recommended jobs */}
      <View style={styles.section}>
        <SectionHeader
          title="Recommended Jobs"
          actionLabel="See all"
          onAction={() => navigation.navigate('MainTabs', { screen: 'Jobs' })}
        />
        {jobs?.slice(0, 3).map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
  },
  locationPill: { flexDirection: 'row', alignItems: 'center' },
  locationText: { marginLeft: 4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  greeting: { marginTop: spacing.md, marginBottom: spacing.md },
  hero: { marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  section: { marginTop: spacing.md },
});
