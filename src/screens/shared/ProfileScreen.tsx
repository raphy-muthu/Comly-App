/**
 * Profile — the current user's identity hub: avatar/name, role switcher,
 * reputation score, verification ladder, and account actions.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import {
  Avatar,
  Card,
  Divider,
  Rating,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import {
  BadgeRow,
  ScoreRing,
  TrustBadge,
  VerificationList,
  YouthSkillsCard,
} from '@/components/trust';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const REPUTATION_FACTORS = [
  { label: 'Reviews', icon: 'star-outline' as const },
  { label: 'Completion rate', icon: 'checkmark-done-outline' as const },
  { label: 'Response speed', icon: 'flash-outline' as const },
  { label: 'Account age', icon: 'calendar-outline' as const },
];

export function ProfileScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const signOut = useAuthStore((s) => s.signOut);

  if (!user) return null;

  const hasBothRoles = user.roles.filter((r) => r !== 'admin').length > 1;

  return (
    <Screen scroll>
      <SectionHeader title="Profile" />

      {/* Identity */}
      <Card padded style={styles.identity}>
        <Avatar uri={user.avatarUrl} name={user.name} size={72} />
        <Text variant="headlineMd" style={styles.name}>
          {user.name}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.outline} />
          <Text variant="bodyMd" color="textSecondary" style={{ marginLeft: 4 }}>
            {user.neighborhood}
          </Text>
        </View>
        <View style={styles.identityMeta}>
          <Rating value={user.rating} count={user.jobsCount} />
          <TrustBadge trusted={user.isTrusted} />
        </View>
        <View style={styles.badges}>
          <BadgeRow profile={user} />
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => navigation.navigate('HelperProfile', { userId: user.id })}
        >
          <Text variant="labelMd" color="textLink">
            Preview my public profile
          </Text>
        </Pressable>
      </Card>

      {/* Role switcher */}
      {hasBothRoles && (
        <View style={styles.switcher}>
          {(['customer', 'helper'] as Role[]).map((r) => {
            const active = activeRole === r;
            return (
              <Pressable
                key={r}
                style={[
                  styles.switchOption,
                  active && { backgroundColor: role.accent },
                ]}
                onPress={() => setActiveRole(r)}
              >
                <Ionicons
                  name={r === 'customer' ? 'hand-left-outline' : 'construct-outline'}
                  size={16}
                  color={active ? role.onAccent : colors.textSecondary}
                />
                <Text
                  variant="labelMd"
                  style={{
                    marginLeft: 6,
                    color: active ? role.onAccent : colors.textSecondary,
                  }}
                >
                  {r === 'customer' ? 'Customer' : 'Helper'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Reputation */}
      <Card padded style={styles.block}>
        <View style={styles.repRow}>
          <ScoreRing value={user.reputationScore} size={72} strokeWidth={6} />
          <View style={styles.repInfo}>
            <Text variant="bodyLg" style={{ fontWeight: '700' }}>
              Reputation Score
            </Text>
            <Text variant="caption" color="textSecondary">
              Calculated from your reviews, completion rate, response speed,
              account age, and verification level.
            </Text>
          </View>
        </View>
        <Divider spacingY={spacing.sm} />
        <View style={styles.factors}>
          {REPUTATION_FACTORS.map((f) => (
            <View key={f.label} style={styles.factor}>
              <Ionicons name={f.icon} size={14} color={role.accent} />
              <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Youth skills (helpers) */}
      {user.roles.includes('helper') && (
        <View style={styles.block}>
          <YouthSkillsCard profile={user} canGenerate />
        </View>
      )}

      {/* Verification */}
      <View style={styles.block}>
        <SectionHeader title="Verification" />
        <Card padded>
          <VerificationList
            status={user.verification}
            hide={
              user.ageGroup === 'adult'
                ? ['schoolEmailVerified', 'parentApproved']
                : []
            }
          />
        </Card>
      </View>

      {/* Settings */}
      <View style={styles.block}>
        <Card padded={false}>
          <SettingsRow
            icon="person-outline"
            label="Edit profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Divider inset />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Safety center"
            onPress={() => navigation.navigate('SafetyCenter')}
          />
          <Divider inset />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & support"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <Divider inset />
          <SettingsRow
            icon="stats-chart-outline"
            label="Community impact"
            onPress={() => navigation.navigate('Impact')}
          />
          <Divider inset />
          <SettingsRow
            icon="leaf-outline"
            label="About Comly"
            onPress={() => navigation.navigate('About')}
          />
          {user.isAdmin && (
            <>
              <Divider inset />
              <SettingsRow
                icon="construct-outline"
                label="Admin console"
                onPress={() => navigation.navigate('Admin')}
              />
            </>
          )}
        </Card>
      </View>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text variant="labelMd" color="error" style={{ marginLeft: 6 }}>
          Sign Out
        </Text>
      </Pressable>
    </Screen>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const role = useRoleTheme();
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={role.accent} />
      <Text variant="bodyMd" style={styles.settingsLabel}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.outline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center' },
  name: { marginTop: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  identityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  badges: { marginTop: spacing.sm, alignItems: 'center', marginBottom: spacing.base },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.full,
    padding: 4,
    marginTop: spacing.md,
  },
  switchOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  block: { marginTop: spacing.md },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  repInfo: { flex: 1 },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  factor: { flexDirection: 'row', alignItems: 'center' },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  settingsLabel: { flex: 1, marginLeft: spacing.sm },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
