/**
 * Help & Support — FAQ plus a support ticket form. Tickets persist to the
 * backend and show up in the admin console; users can track their status here.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  Input,
  Screen,
  SectionHeader,
  Text,
  useToast,
} from '@/components/ui';
import { useCreateSupportTicket, useMySupportTickets } from '@/hooks';
import {
  SupportCategory,
  SUPPORT_CATEGORIES,
  SupportStatus,
} from '@/types/domain';
import { timeAgo } from '@/lib/format';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does payment work?',
    a: 'Comly is a matchmaking app — pay is agreed between neighbors and handled off the app (cash, Venmo, whatever works for both of you). The listed pay is a shared expectation, not an in-app transaction.',
  },
  {
    q: 'How do I contact a helper?',
    a: "Contact details unlock for both of you once you accept a helper's application. Until then, communicate through the job post.",
  },
  {
    q: 'Can teens use Comly?',
    a: 'Yes — that\'s the point! Teen helpers see safety labels on every job, can only apply to age-appropriate tasks, and parent approval unlocks more job types.',
  },
  {
    q: 'Why was my job labeled "Caution"?',
    a: 'Our AI safety review flags weather, physical effort, or equipment concerns so helpers know what to expect. You can request a review if you think a label is wrong.',
  },
  {
    q: 'How do I delete a listing?',
    a: 'Open your job, tap the ••• menu, and choose Delete. Deleted listings leave the feed immediately.',
  },
];

const STATUS_TONE: Record<SupportStatus, 'info' | 'warning' | 'success'> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
};

const CATEGORY_KEYS = Object.keys(SUPPORT_CATEGORIES) as SupportCategory[];

export function HelpSupportScreen() {
  const createTicket = useCreateSupportTicket();
  const { data: myTickets } = useMySupportTickets();
  const toast = useToast();

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [category, setCategory] = useState<SupportCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    createTicket.mutate(
      { category, subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          toast.success("Ticket submitted — we'll get back to you.");
          setSubject('');
          setMessage('');
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not submit.'),
      }
    );
  };

  return (
    <Screen scroll>
      <SectionHeader title="Help & Support" />

      {/* FAQ */}
      <Card padded={false} style={styles.faqCard}>
        {FAQS.map((faq, i) => (
          <View key={faq.q}>
            {i > 0 && <Divider />}
            <Pressable
              style={styles.faqRow}
              onPress={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <View style={styles.faqHeader}>
                <Text variant="bodyLg" style={styles.faqQ}>
                  {faq.q}
                </Text>
                <Ionicons
                  name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.outline}
                />
              </View>
              {openFaq === i && (
                <Text variant="bodyMd" color="textSecondary" style={styles.faqA}>
                  {faq.a}
                </Text>
              )}
            </Pressable>
          </View>
        ))}
      </Card>

      {/* Contact form */}
      <View style={styles.section}>
        <SectionHeader title="Contact Support" />
        <View style={styles.chips}>
          {CATEGORY_KEYS.map((key) => (
            <Chip
              key={key}
              label={SUPPORT_CATEGORIES[key]}
              selected={category === key}
              onPress={() => setCategory(key)}
              style={styles.chip}
            />
          ))}
        </View>
        <Input
          label="Subject"
          placeholder="Short summary"
          value={subject}
          onChangeText={setSubject}
          containerStyle={styles.field}
        />
        <Input
          label="Message"
          placeholder="How can we help?"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          style={styles.multiline}
          containerStyle={styles.field}
        />
        <Button
          title="Submit Ticket"
          icon="send"
          iconPosition="right"
          onPress={submit}
          disabled={subject.trim().length < 3 || message.trim().length < 5}
          loading={createTicket.isPending}
        />
      </View>

      {/* My tickets */}
      <View style={styles.section}>
        <SectionHeader title="My Tickets" />
        {myTickets && myTickets.length > 0 ? (
          myTickets.map((t) => (
            <Card key={t.id} padded style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <Text variant="bodyLg" style={styles.ticketSubject} numberOfLines={1}>
                  {t.subject}
                </Text>
                <Chip
                  label={t.status === 'in_progress' ? 'In progress' : t.status}
                  tone={STATUS_TONE[t.status]}
                />
              </View>
              <Text variant="caption" color="outline">
                {SUPPORT_CATEGORIES[t.category]} · {timeAgo(t.createdAt)}
              </Text>
            </Card>
          ))
        ) : (
          <Card padded>
            <Text variant="bodyMd" color="textSecondary">
              No tickets yet.
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  faqCard: { marginBottom: spacing.base },
  faqRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQ: { flex: 1, fontWeight: '600' },
  faqA: { marginTop: spacing.base },
  section: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: { marginRight: spacing.base, marginBottom: spacing.base },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  ticket: { marginBottom: spacing.sm },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  ticketSubject: { flex: 1 },
});
