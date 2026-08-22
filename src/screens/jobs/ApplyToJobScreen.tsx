/**
 * Apply to Job — helper submits an intro message, an optional pay offer (seeded
 * by an AI suggestion), and availability. Submitting creates an application and
 * dismisses the modal.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, IconButton, Input, Text, useToast } from '@/components/ui';
import { SafetyBadge, EquipmentBadge } from '@/components/trust';
import { useApplyToJob, useJob } from '@/hooks';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { ai, PaySuggestion } from '@/services/ai';
import { formatPayShort } from '@/lib/format';
import { eligibilityFor, JOB_CATEGORIES } from '@/types/domain';
import { useAuthStore } from '@/stores/authStore';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'ApplyToJob'>;

export function ApplyToJobScreen() {
  // Helper-only screen, so it must render in the helper's green, not the
  // customer violet these accents were hardcoded to.
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { data: job } = useJob(params.jobId);
  const apply = useApplyToJob();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);

  const eligibility = job
    ? eligibilityFor(
        job.safetyTier,
        user?.ageGroup ?? 'adult',
        user?.verification.parentApproved ?? false
      )
    : { canApply: true as boolean, reason: undefined as string | undefined };

  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState('');
  const [offer, setOffer] = useState('');
  const [suggestion, setSuggestion] = useState<PaySuggestion | null>(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!job) return;
    let active = true;
    // Matches how the job is actually being paid, not always 'fixed' — this
    // screen shows a helper's proposed-offer suggestion, so it needs the same
    // fixed-vs-hourly distinction the posting side does.
    ai.suggestPay(job.category, job.title, job.payType)
      .then((s) => {
        if (active) setSuggestion(s);
      })
      .catch(() => {
        // Suggestion is a convenience; the offer field works without it.
      });
    return () => {
      active = false;
    };
  }, [job]);

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onClose={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text variant="bodyMd" color="textSecondary">
            Loading…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Fills the message field with a draft the helper then edits. Deliberately
   * not auto-submitted and not auto-run on mount — same "suggestion you accept"
   * pattern as the pay chip above it.
   */
  const draftMessage = async () => {
    if (!job || !user) return;
    setDrafting(true);
    try {
      const text = await ai.suggestApplicationMessage({
        jobTitle: job.title,
        category: job.category,
        jobDescription: job.description,
        neighborhood: user.neighborhood || job.neighborhood,
        helperName: user.name,
        helperSkills: user.skills,
        helperJobsCount: user.jobsCount,
        equipmentProvided:
          job.equipmentStatus === 'yes' || job.equipmentStatus === 'some',
      });
      setMessage(text);
    } catch {
      toast.error('Could not draft a message. Type your own and try again later.');
    } finally {
      setDrafting(false);
    }
  };

  const submit = () => {
    apply.mutate(
      {
        jobId: job.id,
        message: message.trim() || "Hi! I'd love to help with this.",
        proposedPay: offer ? Number(offer) : undefined,
        availability: availability.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Application submitted!');
          navigation.goBack();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Could not apply.'),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header onClose={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Job summary */}
        <Card padded style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={[styles.thumb, { backgroundColor: role.accentSoft }]}>
              <Ionicons
                name={JOB_CATEGORIES[job.category].icon as any}
                size={22}
                color={role.accent}
              />
            </View>
            <View style={styles.summaryInfo}>
              <Text variant="bodyLg" numberOfLines={1}>
                {job.title}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.outline} />
                <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }}>
                  {job.distanceMiles.toFixed(1)} miles away
                </Text>
              </View>
            </View>
            <Text variant="headlineMd" color="secondary">
              {formatPayShort(job.pay, job.payType)}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <SafetyBadge tier={job.safetyTier} />
            <EquipmentBadge status={job.equipmentStatus} />
          </View>
        </Card>

        {!eligibility.canApply && (
          <Card padded style={styles.blockCard}>
            <View style={styles.blockRow}>
              <Ionicons name="lock-closed" size={18} color={colors.error} />
              <Text variant="bodyMd" color="danger" style={styles.blockText}>
                {eligibility.reason}
              </Text>
            </View>
          </Card>
        )}

        {/* AI suggestion */}
        {suggestion && (
          <Card padded style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={16} color={colors.warning} />
              <Text variant="bodyMd" style={styles.aiText}>
                <Text variant="bodyMd" style={{ fontWeight: '700' }}>
                  AI Suggestion:{' '}
                </Text>
                This job usually pays{' '}
                <Text variant="bodyMd" style={{ fontWeight: '700' }}>
                  ${suggestion.min}–${suggestion.max}
                </Text>{' '}
                in your area.
              </Text>
            </View>
            <Chip
              label={`Suggest $${suggestion.recommended} offer`}
              tone="info"
              onPress={() => setOffer(String(suggestion.recommended))}
              style={styles.suggestChip}
            />
          </Card>
        )}

        <View style={styles.messageHeader}>
          <Text variant="labelMd" color="textSecondary">
            SHORT MESSAGE TO CUSTOMER
          </Text>
          <Pressable
            style={styles.draftBtn}
            onPress={draftMessage}
            disabled={drafting}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Draft a message with AI"
          >
            {drafting ? (
              <ActivityIndicator size="small" color={role.accent} />
            ) : (
              <Ionicons name="sparkles" size={14} color={role.accent} />
            )}
            <Text variant="labelMd" style={{ marginLeft: 4, color: role.accent }}>
              {drafting ? 'Writing…' : message ? 'Rewrite' : 'Draft for me'}
            </Text>
          </Pressable>
        </View>
        <Input
          placeholder="Hi! I live nearby and can bring my own shovel and salt…"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          style={styles.multiline}
          hint="AI drafts are a starting point — edit it so it sounds like you."
          containerStyle={styles.field}
        />

        <Input
          label="Your offer (optional)"
          placeholder={String(job.pay)}
          value={offer}
          onChangeText={(t) => setOffer(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          icon="cash-outline"
          containerStyle={styles.field}
        />

        <Input
          label="When are you available?"
          placeholder="e.g. Today after 3 PM"
          value={availability}
          onChangeText={setAvailability}
          icon="calendar-outline"
          hint="Leave blank if available immediately."
          containerStyle={styles.field}
        />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={eligibility.canApply ? 'Submit Application' : 'Not eligible to apply'}
          icon={eligibility.canApply ? 'send' : 'lock-closed'}
          iconPosition="right"
          onPress={submit}
          loading={apply.isPending}
          disabled={!eligibility.canApply}
        />
        <Text variant="caption" color="outline" center style={styles.terms}>
          By applying, you agree to our Safety Guidelines.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon="close" onPress={onClose} />
      <Text variant="headlineMd">Apply to Job</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  summary: { marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base, marginTop: spacing.sm },
  blockCard: { marginBottom: spacing.md, backgroundColor: colors.errorContainer, borderColor: '#fecaca' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  blockText: { flex: 1 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  aiCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  aiHeader: { flexDirection: 'row', gap: spacing.base },
  aiText: { flex: 1 },
  suggestChip: { marginTop: spacing.sm },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  draftBtn: { flexDirection: 'row', alignItems: 'center' },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
  terms: { marginTop: spacing.sm },
});
