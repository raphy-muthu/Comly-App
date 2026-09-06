/**
 * ParentConsentSheet — asks a guardian to approve a minor helper, by email.
 *
 * `verification_status.parent_approved` gates adult_supervision-tier work and
 * has always been pinned against self-service writes, so a minor cannot
 * approve themselves. Until migration 0019 there was also no way for anyone
 * *else* to set it either — the Profile row here used to show a toast telling
 * the user to ask a guardian, with nothing behind it.
 *
 * This sheet only sends the request. Approval happens when the guardian
 * follows the emailed link, server-side; nothing in this component can grant
 * it. The guardian never creates an account.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Input, Text, useToast } from '@/components/ui';
import { parentConsent } from '@/services/parentConsent';
import { ParentApprovalStatus } from '@/types/domain';

export interface ParentConsentSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Prefills the field when the profile already names a guardian. */
  initialEmail?: string;
  status: ParentApprovalStatus;
  /** Called after a successful send so the caller can refetch the profile. */
  onSent?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ParentConsentSheet({
  visible,
  onClose,
  initialEmail,
  status,
  onSent,
}: ParentConsentSheetProps) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
  const toast = useToast();

  const emailError =
    touched && email.trim() && !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : undefined;

  const send = async () => {
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || sending) return;

    setSending(true);
    try {
      const result = await parentConsent.requestApproval(email);
      if (!result.ok) {
        toast.error(result.message ?? 'Could not send the approval request.');
        return;
      }
      toast.success(result.message ?? `Approval request sent to ${email.trim()}.`);
      onSent?.();
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {status === 'approved' ? (
            <>
              <View style={styles.approvedRow}>
                <Ionicons name="shield-checkmark" size={22} color={colors.tertiary} />
                <Text variant="bodyLg" style={styles.approvedText}>
                  Guardian approval complete
                </Text>
              </View>
              <Text variant="caption" color="textSecondary" style={styles.note}>
                You can accept jobs that ask for guardian approval. Jobs marked
                18+ stay unavailable either way.
              </Text>
            </>
          ) : (
            <>
              <Text variant="labelMd" color="textSecondary" style={styles.title}>
                PARENT OR GUARDIAN APPROVAL
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.note}>
                {status === 'pending'
                  ? 'A request is already waiting for your guardian — ask them to ' +
                    'check their inbox, including spam. Sending again issues a new ' +
                    'link and cancels the old one, so use it if the address was wrong.'
                  : 'We’ll email your parent or guardian a link. Approving lets you ' +
                    'accept jobs that ask for guardian approval. They don’t need a ' +
                    'Comly account.'}
              </Text>

              <Input
                label="Parent or guardian email"
                placeholder="parent@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched(true)}
                error={emailError}
                editable={!sending}
                containerStyle={styles.field}
              />

              <Button
                title={status === 'pending' ? 'Send again' : 'Send approval request'}
                icon="mail-outline"
                onPress={send}
                loading={sending}
                disabled={sending}
              />
            </>
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
  title: { marginBottom: 4 },
  note: { marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  approvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.base,
  },
  approvedText: { flex: 1 },
});
