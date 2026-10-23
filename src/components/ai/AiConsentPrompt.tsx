/**
 * AiConsentPrompt — asks once, before any text is sent to Google's Gemini.
 *
 * App Store guideline 5.1.2(i): disclose where personal data goes, "including
 * with third-party AI, and obtain explicit permission before doing so." The
 * screens that use AI (posting a job, applying) render this; it shows itself
 * only when the signed-in account has never answered. Until there's a "yes",
 * the AI service keeps everything on the device (services/aiPermission), and
 * the edge functions refuse the call too.
 *
 * Saying no loses nothing essential: every job still gets a safety label from
 * Comly's built-in rules, and pay hints come from local averages. The answer
 * can be changed later in the Safety Center (AiConsentToggle below).
 *
 * The copy must stay true to what services/ai.ts actually sends.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Card, Text, useToast } from '@/components/ui';
import { useAiConsent, useSetAiConsent } from '@/hooks';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const AI_CONSENT_COPY = {
  title: 'Let AI help with your posts?',
  body:
    'Comly can suggest fair pay, check a job for safety, and help write job descriptions ' +
    'and application messages. To do that, the job details you type (such as the title, ' +
    'description, category, pay, time estimate and neighborhood) are sent through ' +
    "Comly's server to Google's Gemini AI.",
  never: 'Your name, email, phone number, date of birth and photos are never sent.',
  without:
    "If you choose Not now, you can still post and apply. Comly's built-in safety rules " +
    'still label every job. You can change this anytime in Profile → Safety center.',
};

export function AiConsentPrompt() {
  const { needsAnswer } = useAiConsent();
  const setConsent = useSetAiConsent();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  // Closing the sheet without answering hides it for now; it asks again the
  // next time one of these screens opens. Nothing is sent in the meantime.
  const [dismissed, setDismissed] = useState(false);

  const answer = (granted: boolean) =>
    setConsent.mutate(granted, {
      onError: () => toast.error('Could not save your choice. Please try again.'),
    });

  return (
    <Modal
      visible={needsAnswer && !dismissed}
      transparent
      animationType="slide"
      onRequestClose={() => setDismissed(true)}
    >
      <Pressable style={styles.backdrop} onPress={() => setDismissed(true)} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          <Text variant="headlineMd" style={styles.title}>
            {AI_CONSENT_COPY.title}
          </Text>
        </View>
        <Text variant="bodyMd" color="textSecondary" style={styles.body}>
          {AI_CONSENT_COPY.body}
        </Text>
        <Text variant="bodyMd" color="textPrimary" style={styles.body}>
          {AI_CONSENT_COPY.never}
        </Text>
        <Text variant="bodyMd" color="textSecondary" style={styles.body}>
          {AI_CONSENT_COPY.without}
        </Text>
        <Pressable
          onPress={() => {
            setDismissed(true);
            navigation.navigate('Privacy');
          }}
          accessibilityRole="link"
        >
          <Text variant="labelMd" color="primary" style={styles.link}>
            Read the Privacy Policy
          </Text>
        </Pressable>
        <Button
          title="Allow AI help"
          onPress={() => answer(true)}
          loading={setConsent.isPending && setConsent.variables === true}
          disabled={setConsent.isPending}
          style={styles.primary}
        />
        <Button
          title="Not now"
          variant="ghost"
          onPress={() => answer(false)}
          disabled={setConsent.isPending}
        />
      </View>
    </Modal>
  );
}

/** The same choice as a switch, for the Safety Center. */
export function AiConsentToggle() {
  const { consent } = useAiConsent();
  const setConsent = useSetAiConsent();
  const toast = useToast();
  const on = consent === true;

  return (
    <Card padded style={styles.toggleCard}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text variant="bodyLg">AI help</Text>
          <Text variant="bodyMd" color="textSecondary">
            {on
              ? "On. Job details you type are sent to Google's Gemini AI for pay suggestions, safety checks and writing help."
              : "Off. Nothing is sent to AI; Comly's built-in rules still label every job."}
          </Text>
        </View>
        <Switch
          value={on}
          disabled={consent === undefined || setConsent.isPending}
          onValueChange={(value) =>
            setConsent.mutate(value, {
              onSuccess: () => toast.info(value ? 'AI help is on.' : 'AI help is off.'),
              onError: () => toast.error('Could not save your choice. Please try again.'),
            })
          }
          accessibilityLabel="AI help"
        />
      </View>
    </Card>
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
  title: { marginLeft: spacing.xs, flex: 1 },
  body: { marginBottom: spacing.sm },
  link: { marginBottom: spacing.md },
  primary: { marginTop: spacing.sm, marginBottom: spacing.sm },
  toggleCard: { marginBottom: spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 4 },
});
