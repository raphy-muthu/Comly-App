/**
 * Safety Center — educational safety content plus live tools: report a
 * concern, track your reports, and manage blocked users.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import {
  Button,
  Card,
  Chip,
  Divider,
  Screen,
  SectionHeader,
  Text,
  useToast,
} from '@/components/ui';
import {
  useBlockedUsers,
  useMyReports,
  useProfile,
  useUnblockUser,
} from '@/hooks';
import { Report, ReportRiskLevel } from '@/types/domain';
import { timeAgo } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const SAFETY_TIPS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'people-outline',
    title: 'Meet in a safe place',
    body: 'For first-time jobs, meet outside or in a public spot, and let someone know where you are.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Teen helpers',
    body: 'Teens should only take jobs labeled Teen Safe or Caution, keep a parent aware, and never enter a home alone for a first job.',
  },
  {
    icon: 'cash-outline',
    title: 'Agree on pay first',
    body: 'Confirm the pay and how it will be given before work starts. Payment happens between neighbors, off the app.',
  },
  {
    icon: 'flag-outline',
    title: 'Report anything off',
    body: 'Fake listings, no-shows, or uncomfortable behavior — report it and our team will review.',
  },
];

const RISK_TONE: Record<ReportRiskLevel, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

const STATUS_LABEL: Record<Report['status'], string> = {
  open: 'Open',
  reviewing: 'In review',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

export function SafetyCenterScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { data: myReports } = useMyReports();
  const { data: blockedIds } = useBlockedUsers();

  return (
    <Screen scroll>
      <SectionHeader title="Safety Center" />

      {/* Emergency guidance */}
      <Card padded style={styles.emergency}>
        <View style={styles.row}>
          <Ionicons name="warning" size={18} color={colors.error} />
          <Text variant="bodyMd" color="danger" style={styles.rowText}>
            If anyone is in immediate danger, call local emergency services
            before using in-app tools.
          </Text>
        </View>
      </Card>

      {/* Report CTA */}
      <Button
        title="Report a Concern"
        icon="flag"
        onPress={() => navigation.navigate('Report', {})}
        style={styles.reportBtn}
      />

      {/* Tips */}
      <View style={styles.section}>
        <SectionHeader title="Safety Tips" />
        <Card padded={false}>
          {SAFETY_TIPS.map((tip, i) => (
            <View key={tip.title}>
              {i > 0 && <Divider inset />}
              <View style={styles.tipRow}>
                <View style={[styles.tipIcon, { backgroundColor: role.accentSoft }]}>
                  <Ionicons name={tip.icon as any} size={18} color={role.accent} />
                </View>
                <View style={styles.tipBody}>
                  <Text variant="bodyLg" style={styles.tipTitle}>
                    {tip.title}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {tip.body}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* My reports */}
      <View style={styles.section}>
        <SectionHeader title="My Reports" />
        {myReports && myReports.length > 0 ? (
          myReports.map((report) => (
            <Card key={report.id} padded style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Chip
                  label={STATUS_LABEL[report.status]}
                  tone={report.status === 'resolved' ? 'success' : 'info'}
                />
                <Chip
                  label={`${report.riskLevel} risk`}
                  tone={RISK_TONE[report.riskLevel]}
                />
              </View>
              <Text variant="bodyMd" numberOfLines={2} style={styles.reportDesc}>
                {report.description}
              </Text>
              <Text variant="caption" color="outline">
                Filed {timeAgo(report.createdAt)}
              </Text>
            </Card>
          ))
        ) : (
          <Card padded>
            <Text variant="bodyMd" color="textSecondary">
              No reports filed. We hope it stays that way!
            </Text>
          </Card>
        )}
      </View>

      {/* Blocked users */}
      <View style={styles.section}>
        <SectionHeader title="Blocked Users" />
        {blockedIds && blockedIds.length > 0 ? (
          blockedIds.map((id) => <BlockedRow key={id} userId={id} />)
        ) : (
          <Card padded>
            <Text variant="bodyMd" color="textSecondary">
              You haven't blocked anyone.
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function BlockedRow({ userId }: { userId: string }) {
  const { data: profile } = useProfile(userId);
  const unblock = useUnblockUser();
  const toast = useToast();

  return (
    <Card padded style={styles.reportCard}>
      <View style={styles.blockedRow}>
        <Text variant="bodyLg" style={{ flex: 1 }}>
          {profile?.name ?? 'Neighbor'}
        </Text>
        <Button
          title="Unblock"
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPress={() =>
            unblock.mutate(userId, {
              onSuccess: () => toast.info('User unblocked.'),
            })
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  emergency: {
    backgroundColor: colors.errorContainer,
    borderColor: '#fecaca',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base },
  rowText: { flex: 1 },
  reportBtn: { marginBottom: spacing.md },
  section: { marginTop: spacing.md },
  tipRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBody: { flex: 1 },
  tipTitle: { fontWeight: '700', marginBottom: 2 },
  reportCard: { marginBottom: spacing.sm },
  reportHeader: { flexDirection: 'row', gap: spacing.base, marginBottom: spacing.base },
  reportDesc: { marginBottom: spacing.base },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
