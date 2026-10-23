/**
 * Alerts — the notification feed. Unread items get a tinted background and a
 * dot; tapping marks them read and opens what the alert is about (the job
 * when the alert carries one, otherwise the closest screen for its type).
 */

import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, RoleTheme } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Card, EmptyState, Screen, SectionHeader, Text } from '@/components/ui';
import { useNotifications, useMarkNotificationRead } from '@/hooks';
import { AppNotification, NotificationType } from '@/types/domain';
import { timeAgo } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

// application_received uses the active role's accent (violet for customers,
// green for helpers); everything else keeps a fixed semantic color.
function iconsFor(
  role: RoleTheme
): Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> {
  return {
    application_received: { icon: 'person-add', tint: role.accent, bg: role.accentSoft },
    application_accepted: { icon: 'checkmark-circle', tint: colors.tertiary, bg: colors.successSoft },
    application_declined: { icon: 'close-circle', tint: colors.outline, bg: colors.surfaceContainerHigh },
    job_match: { icon: 'sparkles', tint: colors.secondary, bg: colors.infoSoft },
    review_received: { icon: 'star', tint: colors.warning, bg: colors.warningContainer },
    verification: { icon: 'shield-checkmark', tint: colors.tertiary, bg: colors.successSoft },
    report_update: { icon: 'flag', tint: colors.warning, bg: colors.warningContainer },
    job_invite: { icon: 'mail-open', tint: role.accent, bg: role.accentSoft },
    completion_requested: { icon: 'checkmark-done-circle', tint: colors.warning, bg: colors.warningContainer },
    completion_confirmed: { icon: 'trophy', tint: colors.tertiary, bg: colors.successSoft },
    helper_marked_done: { icon: 'checkmark-done-circle', tint: colors.tertiary, bg: colors.successSoft },
    safety: { icon: 'alert-circle', tint: colors.warning, bg: colors.warningContainer },
  };
}

/** Where tapping an alert goes. Alerts from before 0034 carry no job id. */
function openAlert(navigation: Nav, n: AppNotification) {
  switch (n.type) {
    case 'application_received':
      return n.jobId
        ? navigation.navigate('JobApplications', { jobId: n.jobId })
        : navigation.navigate('MyListings');
    case 'application_accepted':
    case 'application_declined':
    case 'job_invite':
    case 'job_match':
      return n.jobId
        ? navigation.navigate('JobDetail', { jobId: n.jobId })
        : navigation.navigate('MyApplications');
    case 'completion_requested':
    case 'completion_confirmed':
    case 'helper_marked_done':
      return n.jobId
        ? navigation.navigate('JobDetail', { jobId: n.jobId })
        : navigation.navigate('MainTabs', { screen: 'Jobs' });
    case 'review_received':
    case 'verification':
      return navigation.navigate('MainTabs', { screen: 'Profile' });
    case 'report_update':
    case 'safety':
      return navigation.navigate('SafetyCenter');
  }
}

export function AlertsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <Screen scroll>
      <SectionHeader title="Alerts" />

      {!isLoading && notifications && notifications.length === 0 && (
        <EmptyState
          icon="notifications-off-outline"
          title="You're all caught up"
          message="New activity from your neighborhood will show up here."
        />
      )}

      {notifications?.map((n) => (
        <NotificationRow
          key={n.id}
          notification={n}
          onPress={() => {
            if (!n.read) markRead.mutate(n.id);
            openAlert(navigation, n);
          }}
        />
      ))}
    </Screen>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const role = useRoleTheme();
  const cfg = iconsFor(role)[notification.type];
  return (
    <Card
      onPress={onPress}
      padded
      style={StyleSheet.flatten([
        styles.card,
        !notification.read && styles.unread,
      ])}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.tint} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="bodyLg" numberOfLines={1} style={styles.title}>
              {notification.title}
            </Text>
            {!notification.read && (
              <View style={[styles.dot, { backgroundColor: role.accent }]} />
            )}
          </View>
          <Text variant="bodyMd" color="textSecondary">
            {notification.body}
          </Text>
          <Text variant="caption" color="outline" style={styles.time}>
            {timeAgo(notification.createdAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.outline} style={styles.chevron} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  unread: { backgroundColor: colors.successSoft, borderColor: '#bbf7d0' },
  row: { flexDirection: 'row', gap: spacing.sm },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  title: { flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  time: { marginTop: 4 },
  chevron: { alignSelf: 'center' },
});
