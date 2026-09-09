/**
 * ReConsentGate — asks an existing user to accept updated legal documents.
 *
 * Renders nothing unless the signed-in user's recorded consent is older than
 * the current re-consent threshold, so it costs nothing on every other launch.
 *
 * Why this exists: the app records which version of each document a user
 * accepted, but until now nothing ever compared that against the current one.
 * A material change to the Terms therefore reached new signups only, while
 * existing accounts kept operating under text they had never seen.
 *
 * Two deliberate choices:
 *
 *   - It is not dismissible. Tapping the backdrop or the Android back button
 *     does nothing, because "continue without agreeing" is exactly the state
 *     this is meant to prevent. The way out is to accept or to sign out.
 *
 *   - Sign out is offered plainly rather than buried. A user who does not agree
 *     to new terms is entitled to leave, and hiding that exit turns a consent
 *     prompt into a hostage situation.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { acceptLegalVersions } from '@/services/auth';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  consentIsCurrent,
} from '@/legal/content';

export function ReConsentGate() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigation = useNavigation<any>();

  // Nothing to ask while signed out, and nothing to ask of an account whose
  // consent is already current.
  if (!user) return null;
  const consent = user.legalConsent;
  if (consentIsCurrent(consent?.termsVersion, consent?.privacyVersion)) return null;

  const firstTime = !consent?.termsVersion && !consent?.privacyVersion;

  const accept = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await acceptLegalVersions(TERMS_VERSION, PRIVACY_VERSION);
      if (!result.ok) {
        toast.error(result.message ?? 'Could not record your agreement.');
        return;
      }
      // Re-read the profile so the new versions land in the store and this
      // gate stops rendering. Without it the modal would stay up over a
      // change that did save.
      await adoptSession();
    } catch {
      toast.error('Could not record your agreement.');
    } finally {
      // Also runs on the success path, where this component usually unmounts
      // and the call is a no-op. It matters when the write succeeded but the
      // re-read came back without the new versions: the gate stays mounted,
      // and leaving `saving` true would spin forever with both buttons
      // disabled — no way forward and no way out.
      setSaving(false);
    }
  };

  const open = (screen: 'Terms' | 'Privacy') => navigation.navigate(screen);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text variant="headlineMd" style={styles.title}>
              {firstTime ? 'Before you continue' : 'We’ve updated our terms'}
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
            <Text variant="bodyMd" color="textSecondary" style={styles.body}>
              {firstTime
                ? 'Please review and accept our Terms of Service and Privacy Policy to keep using Comly.'
                : 'Our Terms of Service and Privacy Policy have changed since you last agreed to them. Please review and accept the current versions to keep using Comly.'}
            </Text>

            <Pressable onPress={() => open('Terms')} style={styles.link}>
              <Text variant="labelMd" color="textLink">
                Read the Terms of Service
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>

            <Pressable onPress={() => open('Privacy')} style={styles.link}>
              <Text variant="labelMd" color="textLink">
                Read the Privacy Policy
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          </ScrollView>

          <Button
            title={saving ? 'Saving…' : 'I agree'}
            onPress={accept}
            loading={saving}
            disabled={saving}
            style={styles.agree}
          />
          {/* Never disabled: this is the only exit from a non-dismissible
              modal, so a stuck save must not take it away too. */}
          <Button title="Sign out instead" variant="ghost" onPress={signOut} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.floating,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { marginLeft: spacing.xs, flex: 1 },
  // Capped so a long explanation cannot push the buttons off a small screen.
  scroll: { maxHeight: 260 },
  scrollBody: { paddingBottom: spacing.xs },
  body: { marginBottom: spacing.md },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  agree: { marginTop: spacing.md, marginBottom: spacing.sm },
});
