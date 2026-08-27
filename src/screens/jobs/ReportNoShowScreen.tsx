/**
 * Report a No-Show — filed by one party of an accepted job against the other.
 *
 * A report is NOT a strike. It lands as `pending` and an admin has to confirm
 * it before anything touches the other person's record, because "they didn't
 * show up" is exactly the accusation a retaliating user would make. The screen
 * says so plainly, so nobody files one expecting an instant consequence.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { Button, Card, IconButton, Input, Text, useToast } from '@/components/ui';
import { useJob, useReportNoShow } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { NO_SHOW_POLICY } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'ReportNoShow'>;

const MIN_NOTE = 10;

export function ReportNoShowScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const { data: job, isLoading } = useJob(params.jobId);
  const reportNoShow = useReportNoShow();
  const toast = useToast();

  const [note, setNote] = useState('');

  const isOwner = !!job && job.customerId === user?.id;
  const isHelper = !!job && job.assignedHelperId === user?.id;
  // Derived from the job, not the route — the accused is always the other
  // party on this specific job.
  const reportedUserId = isOwner ? job?.assignedHelperId : isHelper ? job?.customerId : undefined;
  const reportedLabel = isOwner ? 'your helper' : 'the customer';

  const submit = () => {
    if (!reportedUserId) return;
    reportNoShow.mutate(
      { jobId: params.jobId, reportedUserId, note: note.trim() },
      {
        onSuccess: () => {
          toast.success('Reported. An admin will review it before any strike applies.');
          navigation.goBack();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not submit that report.'),
      }
    );
  };

  const blocked = (() => {
    if (isLoading || !job) return null;
    if (!isOwner && !isHelper) return 'Only the two people on a job can report a no-show.';
    if (!reportedUserId) return 'This job has no accepted helper yet.';
    if (!['accepted', 'in_progress', 'pending_confirmation'].includes(job.status))
      return 'No-shows can only be reported on an accepted job.';
    return null;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Report a No-Show</Text>
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
        ) : blocked ? (
          <Card padded>
            <Text variant="bodyMd" color="textSecondary">
              {blocked}
            </Text>
          </Card>
        ) : (
          <>
            <Card padded style={styles.jobCard}>
              <Text variant="bodyLg" numberOfLines={2}>
                {job.title}
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.jobMeta}>
                Scheduled {job.scheduledFor}
              </Text>
            </Card>

            <Card padded style={styles.policyCard}>
              <View style={styles.policyRow}>
                <Ionicons name="information-circle" size={18} color={colors.warning} />
                <Text variant="bodyMd" color="textSecondary" style={styles.policyText}>
                  This is not an instant penalty. An admin reviews every report
                  before a strike is applied. At{' '}
                  {NO_SHOW_POLICY.suspensionThreshold} confirmed strikes an
                  account can be suspended — and a confirmed strike can be
                  reversed on appeal.
                </Text>
              </View>
            </Card>

            <Input
              label={`What happened with ${reportedLabel}?`}
              placeholder="We agreed on Saturday at 10 AM. I waited an hour and never heard back."
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={5}
              style={styles.multiline}
              hint="Stick to what happened. Harassment or a safety concern belongs in a report instead."
              containerStyle={styles.field}
            />

            <Button
              title="Report a safety concern instead"
              variant="ghost"
              icon="flag-outline"
              size="sm"
              onPress={() =>
                navigation.navigate('Report', {
                  jobId: job.id,
                  reportedUserId,
                })
              }
            />
          </>
        )}
      </ScrollView>

      {!blocked && (
        <View style={styles.footer}>
          <Button
            title="Submit Report"
            onPress={submit}
            disabled={note.trim().length < MIN_NOTE}
            loading={reportNoShow.isPending}
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
  jobCard: { marginBottom: spacing.sm },
  jobMeta: { marginTop: 4 },
  policyCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  policyRow: { flexDirection: 'row', gap: spacing.base },
  policyText: { flex: 1 },
  field: { marginBottom: spacing.sm },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
