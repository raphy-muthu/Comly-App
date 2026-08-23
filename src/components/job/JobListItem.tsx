/**
 * JobListItem — compact row for the customer dashboard "Active Jobs" list:
 * category icon, title, applicant count, pay, status chip, and schedule.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Card, Chip, Text } from '@/components/ui';
import { ChipTone } from '@/components/ui/Chip';
import { Job, JobStatus, JOB_CATEGORIES, JOB_STATUS_LABELS } from '@/types/domain';
import { formatPayShort } from '@/lib/format';

export interface JobListItemProps {
  job: Job;
  onPress: () => void;
}

const STATUS_TONE: Record<JobStatus, ChipTone> = {
  open: 'info',
  reviewing: 'success',
  accepted: 'success',
  in_progress: 'info',
  completed: 'success',
  paused: 'neutral',
  filled: 'neutral',
  cancelled: 'neutral',
};

export function JobListItem({ job, onPress }: JobListItemProps) {
  const category = JOB_CATEGORIES[job.category];

  return (
    <Card onPress={onPress} style={styles.card} padded>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={category.icon as any} size={20} color={colors.primary} />
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text variant="bodyLg" style={styles.title} numberOfLines={1}>
              {job.title}
            </Text>
            <Text variant="headlineMd" color="secondary">
              {formatPayShort(job.pay, job.payType)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={14} color={colors.outline} />
            <Text variant="caption" color="textSecondary" style={styles.meta}>
              {job.applicantsCount}{' '}
              {job.applicantsCount === 1 ? 'applicant' : 'applicants'}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <Chip
              label={JOB_STATUS_LABELS[job.status]}
              tone={STATUS_TONE[job.status]}
            />
            <Text variant="caption" color="outline">
              {job.scheduledFor}
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
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  meta: { marginLeft: 4 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
  },
});
