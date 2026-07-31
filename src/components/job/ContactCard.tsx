/**
 * ContactCard — the contact details revealed after a job is accepted.
 *
 * Shown ONLY to the job owner (sees the accepted helper's contact) and the
 * accepted helper (sees the customer's contact). Payment stays off-platform,
 * so this is how the two neighbors coordinate.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Avatar, Card, Text } from '@/components/ui';
import { JobContact } from '@/types/domain';

export interface ContactCardProps {
  person: JobContact;
  /** e.g. "Your helper" or "Job poster" */
  roleLabel: string;
}

const METHOD_LABEL: Record<string, string> = {
  phone: 'Prefers phone calls',
  text: 'Prefers text messages',
  email: 'Prefers email',
};

export function ContactCard({ person, roleLabel }: ContactCardProps) {
  const role = useRoleTheme();
  return (
    <Card padded style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="lock-open" size={16} color={colors.tertiary} />
        <Text variant="labelMd" color="tertiary" style={styles.headerText}>
          CONTACT UNLOCKED
        </Text>
      </View>

      <View style={styles.row}>
        <Avatar uri={person.avatarUrl} name={person.name} size={48} />
        <View style={styles.info}>
          <Text variant="bodyLg" style={styles.name}>
            {person.name}
          </Text>
          <Text variant="caption" color="textSecondary">
            {roleLabel} · {person.neighborhood}
          </Text>
        </View>
      </View>

      {person.phoneNumber ? (
        <View style={styles.phoneRow}>
          <View style={styles.phoneIcon}>
            <Ionicons name="call" size={16} color={role.accent} />
          </View>
          <View>
            <Text variant="bodyLg" style={styles.name}>
              {person.phoneNumber}
            </Text>
            {person.preferredContactMethod && (
              <Text variant="caption" color="textSecondary">
                {METHOD_LABEL[person.preferredContactMethod]}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <Text variant="caption" color="textSecondary" style={styles.noPhone}>
          No phone number on file — coordinate through the job details.
        </Text>
      )}

      <Text variant="caption" color="outline" style={styles.note}>
        Payment is arranged between neighbors, off the app. Meet in a safe
        place for first-time jobs.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.successSoft,
    borderColor: '#bbf7d0',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  headerText: { marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  name: { fontWeight: '700' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  phoneIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhone: { marginTop: spacing.sm },
  note: { marginTop: spacing.sm },
});
