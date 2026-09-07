/**
 * DeleteAccountSheet — permanently deletes the signed-in user's account.
 *
 * Required by App Store Review Guideline 5.1.1(v): an app that lets you create
 * an account has to let you delete it in-app, not by emailing support.
 *
 * Two deliberate bits of friction, because this is irreversible and sits one
 * tap away from Sign Out:
 *   - the confirm button stays disabled until the word DELETE is typed, so it
 *     cannot be reached by tapping through;
 *   - the sheet says plainly what survives deletion, rather than implying
 *     everything disappears. Reviews written and no-show reports filed stay,
 *     detached from the account, because they are part of the *other* party's
 *     history (migration 0022).
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Input, Text, useToast } from '@/components/ui';
import { deleteAccount } from '@/services/auth';

export interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after the account is gone, so the caller can clear local state. */
  onDeleted: () => void;
}

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountSheet({ visible, onClose, onDeleted }: DeleteAccountSheetProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    if (deleting) return;
    setConfirmText('');
    onClose();
  };

  const run = async () => {
    if (!confirmed || deleting) return;

    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        toast.error(result.message ?? 'Could not delete your account.');
        setDeleting(false);
        return;
      }
      // In demo mode this reports that nothing was deleted; surfacing it beats
      // showing a confirmation for something that did not happen.
      if (result.message) toast.info(result.message);
      setConfirmText('');
      onDeleted();
    } catch {
      toast.error('Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.titleRow}>
          <Ionicons name="warning-outline" size={20} color={colors.error} />
          <Text variant="headlineMd" style={styles.title}>
            Delete your account
          </Text>
        </View>

        <Text variant="bodyMd" color="textSecondary" style={styles.body}>
          This cannot be undone. Your profile, contact details, listings, and
          applications are permanently removed.
        </Text>

        <Text variant="bodyMd" color="textSecondary" style={styles.body}>
          Reviews you wrote and any no-show reports you filed stay on the other
          person's record, with your name removed — they are part of someone
          else's history, not only yours.
        </Text>

        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          editable={!deleting}
        />

        <Button
          title={deleting ? 'Deleting…' : 'Delete my account permanently'}
          onPress={run}
          disabled={!confirmed || deleting}
          loading={deleting}
          style={styles.confirm}
        />
        <Button title="Cancel" variant="ghost" onPress={close} disabled={deleting} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...shadows.floating,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outline,
    marginBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { marginLeft: spacing.xs },
  body: { marginBottom: spacing.md },
  confirm: { marginTop: spacing.md, marginBottom: spacing.sm },
});
