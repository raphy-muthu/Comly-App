/**
 * Customer Dashboard — greeting, search, "post a job" hero, active jobs, and
 * recommended helpers.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import {
  Avatar,
  Card,
  HeroCard,
  IconButton,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import { JobListItem } from '@/components/job/JobListItem';
import { HelperRow } from '@/components/people/HelperRow';
import { InviteHelperSheet } from '@/components/people/InviteHelperSheet';
import { useMyJobs, useRecommendedHelpers } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { greeting } from '@/lib/greeting';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function CustomerDashboard() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { data: myJobs } = useMyJobs();
  const { data: helpers } = useRecommendedHelpers();
  const [inviting, setInviting] = useState<{ id: string; name: string } | null>(
    null
  );

  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <Screen scroll>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text variant="labelMd" color="primary" style={styles.locationText}>
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
        {greeting()}, {firstName}
      </Text>

      {/* Search */}
      <Pressable
        style={styles.search}
        onPress={() => navigation.navigate('CreateJob')}
      >
        <Ionicons name="search" size={20} color={colors.outline} />
        <Text variant="bodyMd" color="outline" style={styles.searchText}>
          What do you need help with?
        </Text>
      </Pressable>

      {/* Hero */}
      <HeroCard
        title="Need help today?"
        subtitle="Post a job now and connect with verified local helpers in minutes."
        ctaLabel="Post a Job"
        onPressCta={() => navigation.navigate('CreateJob')}
        style={styles.hero}
      />

      {/* Senior Help Mode shortcut */}
      <Card
        onPress={() => navigation.navigate('CreateJob', { seniorMode: true })}
        style={styles.seniorCard}
        padded
      >
        <View style={styles.seniorRow}>
          <View style={styles.seniorIcon}>
            <Ionicons name="happy-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.seniorText}>
            <Text variant="bodyLg" style={{ fontWeight: '700' }}>
              I need simple help
            </Text>
            <Text variant="caption" color="textSecondary">
              Bigger buttons, fewer steps — great for seniors.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.outline} />
        </View>
      </Card>

      {/* Active jobs */}
      <SectionHeader
        title="Active Jobs"
        actionLabel={myJobs && myJobs.length > 0 ? 'View All' : undefined}
        onAction={() => navigation.navigate('MainTabs', { screen: 'Jobs' })}
      />
      {myJobs && myJobs.length > 0 ? (
        myJobs
          .slice(0, 3)
          .map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
            />
          ))
      ) : (
        <Text variant="bodyMd" color="textSecondary" style={styles.empty}>
          No active jobs yet. Post your first one above.
        </Text>
      )}

      {/* Recommended helpers */}
      <View style={styles.sectionGap}>
        <SectionHeader title="Recommended Helpers" />
        {helpers?.slice(0, 3).map((helper) => (
          <HelperRow
            key={helper.id}
            helper={helper}
            onPress={() =>
              navigation.navigate('HelperProfile', { userId: helper.id })
            }
            onInvite={() => setInviting({ id: helper.id, name: helper.name })}
          />
        ))}
      </View>

      {inviting && (
        <InviteHelperSheet
          visible
          helperId={inviting.id}
          helperName={inviting.name}
          onClose={() => setInviting(null)}
        />
      )}
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
  greeting: { marginTop: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchText: { marginLeft: spacing.base },
  hero: { marginBottom: spacing.md },
  seniorCard: { marginBottom: spacing.lg },
  seniorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seniorIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seniorText: { flex: 1 },
  empty: { marginBottom: spacing.md },
  sectionGap: { marginTop: spacing.lg },
});
