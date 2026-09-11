/**
 * JobOwnerMenu — bottom-sheet menu of management actions for a job's owner:
 * edit, pause/resume, mark as filled, request completion, cancel, delete
 * (soft). Rules follow the marketplace spec: open jobs are fully editable;
 * completed jobs are not.
 *
 * "Mark as completed" does NOT complete the job any more — it asks the helper
 * to confirm. Completion decides reviews and reputation for the person who did
 * the work, so it shouldn't be one party's unilateral call.
 */

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Divider, IconButton, Text, useToast } from '@/components/ui';
import { useDeleteJob, useRequestJobCompletion, useSetJobStatus } from '@/hooks';
import { Job } from '@/types/domain';

export interface JobOwnerMenuProps {
  job: Job;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Opens the no-show report flow for this job's accepted helper. */
  onReportNoShow: () => void;
  /** Called after the job is deleted (e.g. navigate back). */
  onDeleted: () => void;
}

interface Action {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  run: () => void;
}

export function JobOwnerMenu({
  job,
  visible,
  onClose,
  onEdit,
  onReportNoShow,
  onDeleted,
}: JobOwnerMenuProps) {
  const setStatus = useSetJobStatus();
  const requestCompletion = useRequestJobCompletion();
  const deleteJob = useDeleteJob();
  const toast = useToast();

  const done = job.status === 'completed' || job.status === 'cancelled';

  const change = (status: Job['status'], message: string) => {
    onClose();
    setStatus.mutate(
      { id: job.id, status },
      {
        onSuccess: () => toast.success(message),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed.'),
      }
    );
  };

  const actions: Action[] = [];

  if (!done) {
    actions.push({
      key: 'edit',
      label: 'Edit listing',
      icon: 'create-outline',
      run: () => {
        onClose();
        onEdit();
      },
    });
    if (job.status === 'paused') {
      actions.push({
        key: 'resume',
        label: 'Resume listing',
        icon: 'play-outline',
        run: () => change('open', 'Listing resumed.'),
      });
    } else if (job.status === 'open' || job.status === 'reviewing') {
      actions.push({
        key: 'pause',
        label: 'Pause listing',
        icon: 'pause-outline',
        run: () => change('paused', 'Listing paused.'),
      });
    }
    actions.push({
      key: 'filled',
      label: 'Mark as filled',
      icon: 'checkmark-done-outline',
      run: () => change('filled', 'Marked as filled.'),
    });
    if (job.status === 'accepted' || job.status === 'in_progress') {
      actions.push({
        key: 'complete',
        label: 'Mark as completed',
        icon: 'trophy-outline',
        run: () => {
          onClose();
          requestCompletion.mutate(job.id, {
            onSuccess: () =>
              toast.success('Sent to your helper to confirm — then you can both review.'),
            onError: (e) =>
              toast.error(e instanceof Error ? e.message : 'Failed.'),
          });
        },
      });
    }
    if (job.status === 'pending_confirmation') {
      actions.push({
        key: 'awaiting',
        label: 'Waiting on helper confirmation',
        icon: 'hourglass-outline',
        run: () => {
          onClose();
          toast.info('Your helper still needs to confirm this job is finished.');
        },
      });
    }
    if (
      job.assignedHelperId &&
      ['accepted', 'in_progress', 'pending_confirmation'].includes(job.status)
    ) {
      actions.push({
        key: 'no_show',
        label: 'Report a no-show',
        icon: 'person-remove-outline',
        destructive: true,
        run: () => {
          onClose();
          onReportNoShow();
        },
      });
    }
    actions.push({
      key: 'cancel',
      label: 'Cancel job',
      icon: 'close-circle-outline',
      destructive: true,
      run: () => change('cancelled', 'Job cancelled.'),
    });
  }

  actions.push({
    key: 'delete',
    label: 'Delete listing',
    icon: 'trash-outline',
    destructive: true,
    run: () => {
      onClose();
      deleteJob.mutate(job.id, {
        onSuccess: () => {
          toast.info('Listing deleted.');
          onDeleted();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed.'),
      });
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* accessible={false} on both wrapping Pressables: a Pressable defaults
          accessible=true whenever it has onPress, and an accessible=true View
          merges its ENTIRE subtree into one accessibility element. Left
          unset, VoiceOver got a single element the size of the screen with
          every row's icon and label concatenated into one unreadable,
          unselectable string — the whole menu was unusable non-visually.
          Setting it false here only changes what's exposed to accessibility;
          the backdrop's own tap-to-dismiss keeps working for everyone else. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text
              variant="labelMd"
              color="textSecondary"
              style={styles.title}
              accessibilityRole="header"
            >
              MANAGE LISTING
            </Text>
            {/* An explicit way out: with the backdrop no longer exposed to
                accessibility, a VoiceOver user needs a real close control
                rather than only the destructive actions below. */}
            <IconButton
              icon="close"
              size={20}
              onPress={onClose}
              accessibilityLabel="Close menu"
            />
          </View>
          {actions.map((a, i) => (
            <View key={a.key}>
              {i > 0 && <Divider />}
              <Pressable
                style={styles.row}
                onPress={a.run}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Ionicons
                  name={a.icon}
                  size={20}
                  color={a.destructive ? colors.error : colors.primary}
                />
                <Text
                  variant="bodyLg"
                  color={a.destructive ? 'danger' : 'textPrimary'}
                  style={styles.label}
                >
                  {a.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    ...shadows.floating,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  title: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  label: { marginLeft: spacing.sm },
});
