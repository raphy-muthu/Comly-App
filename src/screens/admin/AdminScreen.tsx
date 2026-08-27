/**
 * Admin console — a deliberately minimal in-app moderation surface: the reports
 * queue (with AI risk triage), support tickets, and the no-show queue, each
 * with resolve actions. This is where support tickets submitted from Help &
 * Support land.
 * Gated by profile.isAdmin. A production deployment would likely grow this into
 * a separate web tool; this proves the moderation loop end-to-end.
 *
 * Escalation note: admins follow school/community safety procedures and
 * applicable law — the app never auto-contacts authorities.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, getRoleTheme, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Chip,
  IconButton,
  Text,
  useToast,
} from '@/components/ui';
import {
  useAllNoShows,
  useAllReports,
  useAllSupportTickets,
  useResolveNoShow,
  useUpdateReport,
  useUpdateSupportTicket,
} from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import {
  NoShowEvent,
  NO_SHOW_STATUS_LABELS,
  Report,
  ReportRiskLevel,
  REPORT_CATEGORIES,
  SupportTicket,
  SUPPORT_CATEGORIES,
} from '@/types/domain';
import { timeAgo } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'reports' | 'tickets' | 'noshows';

const RISK_TONE: Record<ReportRiskLevel, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

const adminTheme = getRoleTheme('admin');

export function AdminScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('reports');

  const { data: reports } = useAllReports();
  const { data: tickets } = useAllSupportTickets();
  const { data: noShows } = useAllNoShows();

  if (!user?.isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={32} color={colors.outline} />
          <Text variant="bodyMd" color="textSecondary" style={styles.deniedText}>
            Admin access required.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openReports = reports?.filter((r) => r.status !== 'resolved') ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navy admin header */}
      <View style={[styles.header, { backgroundColor: adminTheme.accent }]}>
        <IconButton
          icon="arrow-back"
          color={adminTheme.onAccent}
          onPress={() => navigation.goBack()}
        />
        <Text variant="headlineMd" style={{ color: adminTheme.onAccent }}>
          Admin Console
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          label={`Reports (${openReports.length})`}
          active={tab === 'reports'}
          onPress={() => setTab('reports')}
        />
        <TabButton
          label={`Tickets (${tickets?.filter((t) => t.status !== 'resolved').length ?? 0})`}
          active={tab === 'tickets'}
          onPress={() => setTab('tickets')}
        />
        <TabButton
          label={`No-shows (${noShows?.filter((e) => e.status === 'pending').length ?? 0})`}
          active={tab === 'noshows'}
          onPress={() => setTab('noshows')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'reports' && (
          <>
            <Card padded style={styles.escalation}>
              <Text variant="caption" color="textSecondary">
                Escalation: follow school/community safety procedures and
                applicable law. Do not handle emergencies through the app.
              </Text>
            </Card>
            {reports?.map((r) => <ReportRow key={r.id} report={r} />)}
            {reports?.length === 0 && (
              <Text variant="bodyMd" color="textSecondary">
                No reports. 🎉
              </Text>
            )}
          </>
        )}

        {tab === 'tickets' && (
          <>
            {tickets?.map((t) => <TicketRow key={t.id} ticket={t} />)}
            {tickets?.length === 0 && (
              <Text variant="bodyMd" color="textSecondary">
                No support tickets.
              </Text>
            )}
          </>
        )}

        {tab === 'noshows' && (
          <>
            <Card padded style={styles.escalation}>
              <Text variant="caption" color="textSecondary">
                Confirming a report applies a strike to the reported account;
                dismissing (or reversing) one takes it back. Three confirmed
                strikes suspends an account, so weigh both sides before
                confirming.
              </Text>
            </Card>
            {noShows?.map((e) => <NoShowRow key={e.id} event={e} />)}
            {noShows?.length === 0 && (
              <Text variant="bodyMd" color="textSecondary">
                No no-show reports.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.tabWrap}>
      <Button
        title={label}
        variant={active ? 'primary' : 'ghost'}
        size="sm"
        onPress={onPress}
      />
    </View>
  );
}

function ReportRow({ report }: { report: Report }) {
  const updateReport = useUpdateReport();
  const toast = useToast();

  const setStatus = (status: Report['status'], msg: string) =>
    updateReport.mutate(
      { id: report.id, patch: { status } },
      { onSuccess: () => toast.success(msg) }
    );

  return (
    <Card padded style={styles.item}>
      <View style={styles.itemHeader}>
        <Chip label={REPORT_CATEGORIES[report.category]} tone="neutral" />
        <Chip label={`${report.riskLevel} risk`} tone={RISK_TONE[report.riskLevel]} />
      </View>
      <Text variant="bodyMd" style={styles.itemBody}>
        {report.description}
      </Text>
      {report.aiSummary && (
        <View style={styles.aiRow}>
          <Ionicons name="sparkles" size={13} color={colors.secondary} />
          <Text variant="caption" color="textSecondary" style={styles.aiText}>
            {report.aiSummary}
          </Text>
        </View>
      )}
      <Text variant="caption" color="outline">
        {timeAgo(report.createdAt)} · status: {report.status}
      </Text>

      {report.status !== 'resolved' && (
        <View style={styles.actions}>
          <Button
            title="Resolve"
            size="sm"
            fullWidth={false}
            onPress={() => setStatus('resolved', 'Report resolved.')}
          />
          {report.status !== 'reviewing' && (
            <Button
              title="Review"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => setStatus('reviewing', 'Marked as in review.')}
            />
          )}
          {report.status !== 'escalated' && (
            <Button
              title="Escalate"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => setStatus('escalated', 'Escalated per safety procedures.')}
            />
          )}
        </View>
      )}
    </Card>
  );
}

function NoShowRow({ event }: { event: NoShowEvent }) {
  const resolve = useResolveNoShow();
  const toast = useToast();

  const decide = (status: NoShowEvent['status'], msg: string) =>
    resolve.mutate(
      { id: event.id, status },
      {
        onSuccess: () => toast.success(msg),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed.'),
      }
    );

  return (
    <Card padded style={styles.item}>
      <View style={styles.itemHeader}>
        <Text variant="bodyLg" style={styles.ticketSubject} numberOfLines={1}>
          {event.jobTitle ?? 'Job'}
        </Text>
        <Chip
          label={NO_SHOW_STATUS_LABELS[event.status]}
          tone={
            event.status === 'confirmed'
              ? 'danger'
              : event.status === 'dismissed'
                ? 'neutral'
                : 'warning'
          }
        />
      </View>
      <Text variant="bodyMd" color="textSecondary" style={styles.itemBody}>
        {event.note || 'No details given.'}
      </Text>
      <Text variant="caption" color="outline">
        {timeAgo(event.createdAt)} · reported user {event.reportedUserId.slice(0, 8)}
      </Text>

      <View style={styles.actions}>
        {event.status !== 'confirmed' && (
          <Button
            title="Confirm strike"
            size="sm"
            fullWidth={false}
            onPress={() => decide('confirmed', 'Strike applied.')}
          />
        )}
        {event.status !== 'dismissed' && (
          <Button
            title="Dismiss"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => decide('dismissed', 'Report dismissed.')}
          />
        )}
        {event.status !== 'pending' && (
          <Button
            title="Reopen"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => decide('pending', 'Reopened for review.')}
          />
        )}
      </View>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const updateTicket = useUpdateSupportTicket();
  const toast = useToast();

  return (
    <Card padded style={styles.item}>
      <View style={styles.itemHeader}>
        <Text variant="bodyLg" style={styles.ticketSubject} numberOfLines={1}>
          {ticket.subject}
        </Text>
        <Chip
          label={ticket.status === 'in_progress' ? 'In progress' : ticket.status}
          tone={ticket.status === 'resolved' ? 'success' : 'info'}
        />
      </View>
      <Text variant="bodyMd" color="textSecondary" style={styles.itemBody}>
        {ticket.message}
      </Text>
      <Text variant="caption" color="outline">
        {SUPPORT_CATEGORIES[ticket.category]} · {timeAgo(ticket.createdAt)}
      </Text>

      {ticket.status !== 'resolved' && (
        <View style={styles.actions}>
          <Button
            title="Resolve"
            size="sm"
            fullWidth={false}
            onPress={() =>
              updateTicket.mutate(
                { id: ticket.id, status: 'resolved' },
                { onSuccess: () => toast.success('Ticket resolved.') }
              )
            }
          />
          {ticket.status === 'open' && (
            <Button
              title="Start"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() =>
                updateTicket.mutate(
                  { id: ticket.id, status: 'in_progress' },
                  { onSuccess: () => toast.info('Ticket in progress.') }
                )
              }
            />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deniedText: { marginTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
  },
  headerSpacer: { width: 40 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
  },
  tabWrap: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.xl,
  },
  escalation: {
    marginBottom: spacing.sm,
    backgroundColor: colors.warningContainer,
    borderColor: '#fde68a',
  },
  item: { marginBottom: spacing.sm },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    marginBottom: spacing.base,
  },
  itemBody: { marginBottom: spacing.base },
  aiRow: { flexDirection: 'row', gap: 4, marginBottom: spacing.base },
  aiText: { flex: 1 },
  ticketSubject: { flex: 1, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.sm,
    borderRadius: radius.base,
  },
});
