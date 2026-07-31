/**
 * VerificationList — the verification badges a user can earn (email, phone,
 * profile photo, school email, parent approval). Government ID verification is
 * intentionally not part of Comly.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';
import {
  VerificationKey,
  VerificationStatus,
  VERIFICATION_BADGES,
} from '@/types/domain';

export interface VerificationListProps {
  status: VerificationStatus;
  /** Hide rows that don't apply (e.g. parent approval for adults). */
  hide?: VerificationKey[];
}

const ORDER: VerificationKey[] = [
  'emailVerified',
  'phoneAdded',
  'photoAdded',
  'schoolEmailVerified',
  'parentApproved',
];

export function VerificationList({ status, hide = [] }: VerificationListProps) {
  return (
    <View>
      {ORDER.filter((k) => !hide.includes(k)).map((key) => {
        const done = status[key];
        const meta = VERIFICATION_BADGES[key];
        return (
          <View key={key} style={styles.row}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: done ? colors.successSoft : colors.surfaceContainerHigh },
              ]}
            >
              <Ionicons
                name={(done ? 'checkmark-circle' : 'lock-closed') as any}
                size={18}
                color={done ? colors.tertiary : colors.outline}
              />
            </View>
            <View style={styles.body}>
              <Text variant="bodyMd" color={done ? 'textPrimary' : 'textSecondary'}>
                {meta.label}
              </Text>
              <Text variant="caption" color="outline">
                {meta.description}
              </Text>
            </View>
            {!done && (
              <Text variant="labelMd" color="textLink">
                Add
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.base,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
});
