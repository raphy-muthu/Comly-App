/**
 * My Jobs (helper side) — everything the current helper has a stake in, in one
 * place: jobs they were accepted for, jobs awaiting their completion
 * confirmation, invitations to apply, and applications still pending.
 *
 * The customer's equivalent is MyJobsScreen (the jobs they posted); both are
 * reachable from Profile → settings so "My Jobs" and "My Listings" mean the
 * same thing to both roles.
 */

import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  SectionHeader,
  Text,
} from '@/components/ui';
import { useMyApplications, useMyInvites } from '@/hooks';
import { Application, ApplicationStatus } from '@/types/domain';
import { timeAgo, formatPayShort } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STATUS_CHIP: Record<
  ApplicationStatus,
  { label: string; tone: 'success' | 'neutral' | 'info' | 'warning' }
> = {
  pending: { label: 'Pending', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
  not_selected: { label: 'Not selected', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function MyApplicationsScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { data: applications, isLoading } = useMyApplications();
  const { data: invites } = useMyInvites();

  // Accepted work first — it's the only group with something to actually do.
  const sorted = useMemo(() => {
    const rank: Record<ApplicationStatus, number> = {
      accepted: 0,
      pending: 1,
      not_selected: 2,
      declined: 3,
      withdrawn: 4,
    };
    return [...(applications ?? [])].sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [applications]);

  const openInvites = (invites ?? []).filter((i) => i.status === 'sent');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">My Jobs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(app: Application) => app.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          openInvites.length > 0 ? (
            <View style={styles.invites}>
              <SectionHeader title="Invitations to Apply" />
              {openInvites.map((invite) => (
                <Card
                  key={invite.id}
                  padded
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('JobDetail', { jobId: invite.jobId })
                  }
                >
                  <View style={styles.row}>
                    <Ionicons name="mail-open-outline" size={18} color={role.accent} />
                    <View style={styles.rowBody}>
                      <Text variant="bodyLg" numberOfLines={1}>
                        {invite.jobTitle ?? 'A neighbor invited you'}
                      </Text>
                      <Text variant="caption" color="textSecondary">
                        A customer thinks you'd be a good fit ·{' '}
                        {timeAgo(invite.createdAt)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.outline} />
                  </View>
                </Card>
              ))}
              <SectionHeader title="My Applications" />
            </View>
          ) : (
            <SectionHeader title="My Applications" />
          )
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="briefcase-outline"
              title="No applications yet"
              message="Browse the job feed and apply — everything you apply to shows up here."
              actionLabel="Find Jobs"
              onAction={() => navigation.navigate('MainTabs', { screen: 'Jobs' })}
            />
          ) : null
        }
        renderItem={({ item: app }) => {
          const chip = STATUS_CHIP[app.status];
          return (
            <Card
              padded
              style={styles.card}
              onPress={() => navigation.navigate('JobDetail', { jobId: app.jobId })}
            >
              <View style={styles.cardHeader}>
                <Text variant="bodyLg" style={styles.cardTitle} numberOfLines={1}>
                  {app.message || 'Your application'}
                </Text>
                <Chip label={chip.label} tone={chip.tone} />
              </View>
              <View style={styles.metaRow}>
                {app.proposedPay !== undefined && (
                  <Text variant="caption" color="textSecondary">
                    Offer: {formatPayShort(app.proposedPay, 'fixed')}
                  </Text>
                )}
                <Text variant="caption" color="outline">
                  Applied {timeAgo(app.createdAt)}
                </Text>
              </View>
              {app.status === 'accepted' && (
                <Text variant="caption" style={{ color: role.accent, marginTop: 4 }}>
                  You're hired — open the job for contact details.
                </Text>
              )}
            </Card>
          );
        }}
      />
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
  list: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
  invites: {},
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBody: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
});
