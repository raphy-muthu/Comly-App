/**
 * YouthSkillsCard — "Skills Built Through Comly": the skills a helper has
 * developed (from their profile + completed job categories), plus an AI
 * experience-summary generator that can be shared/copied — Comly is about
 * skills and responsibility, not just money.
 */

import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Button, Card, Text } from '@/components/ui';
import { ai } from '@/services/ai';
import { JOB_CATEGORIES, UserProfile } from '@/types/domain';

export interface YouthSkillsCardProps {
  profile: Pick<
    UserProfile,
    'jobsCount' | 'rating' | 'skills' | 'preferredCategories' | 'resumeSummary'
  >;
  /** Show the resume generator (own profile only). */
  canGenerate?: boolean;
}

export function YouthSkillsCard({ profile, canGenerate }: YouthSkillsCardProps) {
  const role = useRoleTheme();
  const [summary, setSummary] = useState<string | null>(
    profile.resumeSummary ?? null
  );
  const [generating, setGenerating] = useState(false);

  // Merge explicit skills with skills implied by worked categories.
  const skills = Array.from(
    new Set([
      ...profile.skills,
      ...profile.preferredCategories.slice(0, 3).map((c) => JOB_CATEGORIES[c].label),
    ])
  ).slice(0, 8);

  const generate = async () => {
    setGenerating(true);
    setSummary(await ai.generateResumeSummary(profile));
    setGenerating(false);
  };

  const share = () => {
    if (summary) Share.share({ message: summary });
  };

  return (
    <Card padded>
      <View style={styles.headerRow}>
        <View style={[styles.iconWell, { backgroundColor: role.accentSoft }]}>
          <Ionicons name="school" size={18} color={role.accent} />
        </View>
        <Text variant="bodyLg" style={styles.title}>
          Skills Built Through Comly
        </Text>
      </View>

      {skills.length > 0 ? (
        <View style={styles.skills}>
          {skills.map((skill) => (
            <View key={skill} style={styles.skillRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.tertiary} />
              <Text variant="bodyMd" style={styles.skillText}>
                {skill}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="bodyMd" color="textSecondary" style={styles.skills}>
          Skills appear here as jobs get completed.
        </Text>
      )}

      {summary && (
        <View style={styles.summaryBox}>
          <Text variant="bodyMd" style={styles.summaryText}>
            “{summary}”
          </Text>
        </View>
      )}

      {canGenerate && (
        <View style={styles.actions}>
          <Button
            title={summary ? 'Regenerate Summary' : 'Generate Experience Summary'}
            variant="secondary"
            size="md"
            icon="sparkles-outline"
            onPress={generate}
            loading={generating}
          />
          {summary && (
            <Button
              title="Share / Copy"
              variant="ghost"
              size="sm"
              icon="share-outline"
              onPress={share}
            />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', flex: 1 },
  skills: { marginTop: spacing.sm },
  skillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  skillText: { marginLeft: spacing.base },
  summaryBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  summaryText: { fontStyle: 'italic' },
  actions: { marginTop: spacing.sm, gap: spacing.base },
});
