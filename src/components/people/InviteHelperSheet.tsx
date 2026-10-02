/**
 * InviteHelperSheet — "Invite to apply", the safety-preserving answer to
 * contacting a recommended helper.
 *
 * Comly deliberately unlocks contact details only after an application is
 * accepted, so that no unvetted adult can reach a teen helper outside the
 * safety review. A raw "message this helper" button on a recommendation card
 * would reopen exactly that gap. An invite instead points the helper at one of
 * the customer's own open listings: no phone number, email, or free text
 * crosses over, and the helper still applies through the normal flow with the
 * teen-safety gate intact.
 */

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Divider, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import { useInviteHelper, useMyJobs } from '@/hooks';
import { categoryLabel, Job } from '@/types/domain';

export interface InviteHelperSheetProps {
  helperId: string;
  helperName: string;
  visible: boolean;
  onClose: () => void;
}

/** Only listings a helper could actually apply to are worth inviting them to. */
const INVITABLE: Job['status'][] = ['open', 'reviewing'];

export function InviteHelperSheet({
  helperId,
  helperName,
  visible,
  onClose,
}: InviteHelperSheetProps) {
  const { data: jobs, isLoading } = useMyJobs();
  const invite = useInviteHelper();
  const toast = useToast();

  const openJobs = (jobs ?? []).filter(
    (j) => INVITABLE.includes(j.status) && !j.isPaused && !j.deletedAt
  );

  const send = (jobId: string) => {
    onClose();
    invite.mutate(
      { jobId, helperId },
      {
        onSuccess: () =>
          toast.success(`${helperName} was invited to apply. Contact stays private until you accept.`),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not send that invite.'),
      }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* accessible={false} on both wrapping Pressables, same as JobOwnerMenu:
          a Pressable with onPress defaults to accessible=true, which merges
          its whole subtree into ONE VoiceOver element — every job row read
          as one string, none individually selectable. */}
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
              INVITE {helperName.toUpperCase()} TO APPLY
            </Text>
            {/* The backdrop is no longer exposed to accessibility, so
                VoiceOver users need a real way out. */}
            <IconButton icon="close" size={20} onPress={onClose} accessibilityLabel="Close" />
          </View>
          <Text variant="caption" color="textSecondary" style={styles.note}>
            They'll get a notification pointing at your listing. Phone numbers
            stay private until you accept their application.
          </Text>

          {openJobs.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title={isLoading ? 'Loading your listings…' : 'No open listings'}
              message="Post a job first — invites point a helper at a specific listing."
            />
          ) : (
            openJobs.map((job, i) => (
              <View key={job.id}>
                {i > 0 && <Divider />}
                <Pressable
                  style={styles.row}
                  onPress={() => send(job.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Invite to ${job.title}, ${categoryLabel(
                    job.category,
                    job.customCategoryText
                  )}, ${job.scheduledFor}`}
                >
                  <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
                  <View style={styles.rowBody}>
                    <Text variant="bodyLg" numberOfLines={1}>
                      {job.title}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {categoryLabel(job.category, job.customCategoryText)} ·{' '}
                      {job.scheduledFor}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.outline} />
                </Pressable>
              </View>
            ))
          )}
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
    marginBottom: 4,
  },
  title: { flex: 1 },
  note: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  rowBody: { flex: 1 },
});
