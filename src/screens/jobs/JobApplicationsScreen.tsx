/**
 * Job Applications — customer reviews helpers who applied: their intro message,
 * proposed pay, availability, trust badge, and accept/decline actions.
 */

import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Rating,
  Text,
  useToast,
} from '@/components/ui';
import { PremiumBadge, TrustBadge } from '@/components/trust';
import {
  useAcceptApplication,
  useDeclineApplication,
  useJob,
  useJobApplications,
} from '@/hooks';
import { Application } from '@/types/domain';
import { formatPayShort } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'JobApplications'>;

export function JobApplicationsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { data: job } = useJob(params.jobId);
  const { data: applications, isLoading } = useJobApplications(params.jobId);
  const accept = useAcceptApplication();
  const decline = useDeclineApplication();
  const toast = useToast();

  const jobDecided =
    job?.status === 'accepted' ||
    job?.status === 'completed' ||
    job?.status === 'cancelled';

  const onAccept = (applicationId: string, name: string) =>
    accept.mutate(
      { jobId: params.jobId, applicationId },
      {
        onSuccess: () => toast.success(`${name} accepted — contact unlocked.`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed.'),
      }
    );

  const onDecline = (applicationId: string) =>
    decline.mutate(
      { jobId: params.jobId, applicationId },
      {
        onSuccess: () => toast.info('Application declined.'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed.'),
      }
    );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Applications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {job && (
        <>
          <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
            {job.title} · {applications?.length ?? 0} applicant
            {(applications?.length ?? 0) === 1 ? '' : 's'}
          </Text>
          {applications?.some((a) => a.isPriority) && (
            <Text variant="caption" color="outline" style={styles.sortNote}>
              Pro Helper applications sort first. Everyone who applied is still
              listed below — ratings and completed jobs decide the rest.
            </Text>
          )}
        </>
      )}

      <FlatList
        data={applications ?? []}
        keyExtractor={(app) => app.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No applications yet"
              message="When neighbors apply, you'll see them here."
            />
          ) : null
        }
        renderItem={({ item: app }) => (
          <ApplicationCard
            application={app}
            jobDecided={jobDecided}
            busy={accept.isPending || decline.isPending}
            onAccept={() => onAccept(app.id, app.helper.name)}
            onDecline={() => onDecline(app.id)}
            onViewProfile={() =>
              navigation.navigate('HelperProfile', { userId: app.helperId })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const STATUS_CHIP: Record<
  Application['status'],
  { label: string; tone: 'success' | 'neutral' | 'warning' } | null
> = {
  pending: null,
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
  not_selected: { label: 'Not selected', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

function ApplicationCard({
  application,
  jobDecided,
  busy,
  onAccept,
  onDecline,
  onViewProfile,
}: {
  application: Application;
  jobDecided: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile: () => void;
}) {
  const { helper } = application;
  const statusChip = STATUS_CHIP[application.status];
  const showActions = application.status === 'pending' && !jobDecided;

  return (
    <Card padded style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={onViewProfile}>
        <Avatar uri={helper.avatarUrl} name={helper.name} size={48} />
        <View style={styles.helperInfo}>
          <Text variant="bodyLg">{helper.name}</Text>
          <Rating value={helper.rating} count={helper.jobsCount} />
          {application.isPriority && (
            <View style={styles.priorityRow}>
              <PremiumBadge kind="helper_pro" label={application.priorityReason} />
            </View>
          )}
        </View>
        {statusChip ? (
          <Chip label={statusChip.label} tone={statusChip.tone} />
        ) : (
          <TrustBadge trusted={helper.isTrusted} compact />
        )}
      </Pressable>

      <Text variant="bodyMd" color="textPrimary" style={styles.message}>
        “{application.message}”
      </Text>

      <View style={styles.metaRow}>
        {application.proposedPay !== undefined && (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color={colors.outline} />
            <Text variant="caption" color="textSecondary" style={styles.metaText}>
              Offer: {formatPayShort(application.proposedPay, 'fixed')}
            </Text>
          </View>
        )}
        {application.availability && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.outline} />
            <Text variant="caption" color="textSecondary" style={styles.metaText}>
              {application.availability}
            </Text>
          </View>
        )}
      </View>

      {showActions && (
        <View style={styles.actions}>
          <Button
            title="Decline"
            variant="secondary"
            size="md"
            onPress={onDecline}
            disabled={busy}
            style={styles.actionBtn}
          />
          <Button
            title="Accept"
            size="md"
            onPress={onAccept}
            loading={busy}
            style={styles.actionBtn}
          />
        </View>
      )}
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
  subtitle: { paddingHorizontal: spacing.marginMobile, marginTop: spacing.base },
  sortNote: { paddingHorizontal: spacing.marginMobile, marginTop: 4 },
  priorityRow: { marginTop: 4 },
  list: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: { marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helperInfo: { flex: 1 },
  message: { marginTop: spacing.sm, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
