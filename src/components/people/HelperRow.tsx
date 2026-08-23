/**
 * HelperRow — recommended-helper list row: avatar, name, rating, and compact
 * actions.
 *
 * `onInvite` adds an "Invite" affordance. It is deliberately an invite-to-apply
 * and not a contact button: contact details unlock only after an application is
 * accepted (see InviteHelperSheet for why that gate matters).
 */

import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Avatar, Card, Rating, Text } from '@/components/ui';
import { UserProfile } from '@/types/domain';

export interface HelperRowProps {
  helper: Pick<
    UserProfile,
    'id' | 'name' | 'avatarUrl' | 'rating' | 'jobsCount'
  >;
  onPress: () => void;
  /** Omit to render the row without an invite action (e.g. for helpers). */
  onInvite?: () => void;
}

export function HelperRow({ helper, onPress, onInvite }: HelperRowProps) {
  return (
    <Card style={styles.card} padded>
      <View style={styles.row}>
        <Avatar uri={helper.avatarUrl} name={helper.name} size={44} />
        <View style={styles.body}>
          <Text variant="bodyLg" numberOfLines={1}>
            {helper.name}
          </Text>
          <Rating value={helper.rating} count={helper.jobsCount} />
        </View>
        {onInvite && (
          <Card
            onPress={onInvite}
            style={styles.inviteBtn}
            padded={false}
            elevation="none"
            accessibilityLabel={`Invite ${helper.name} to apply`}
          >
            <Text variant="labelMd" color="tertiary">
              Invite
            </Text>
          </Card>
        )}
        <Card onPress={onPress} style={styles.viewBtn} padded={false} elevation="none">
          <Text variant="labelMd" color="primary">
            View
          </Text>
        </Card>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { flex: 1 },
  viewBtn: {
    backgroundColor: colors.brandSoft,
    borderWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
  },
  inviteBtn: {
    backgroundColor: colors.successSoft,
    borderWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
  },
});
