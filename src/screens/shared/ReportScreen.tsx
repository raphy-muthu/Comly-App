/**
 * Report — file a safety/quality report about a user or listing. Reachable from
 * job details, profiles, and the Safety Center. Reports get a mock AI risk
 * triage and land in the admin console.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import {
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Text,
  useToast,
} from '@/components/ui';
import { useCreateReport } from '@/hooks';
import { ReportCategory, REPORT_CATEGORIES } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'Report'>;

const CATEGORY_KEYS = Object.keys(REPORT_CATEGORIES) as ReportCategory[];

export function ReportScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const createReport = useCreateReport();
  const toast = useToast();

  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');

  const submit = () => {
    if (!category) return;
    createReport.mutate(
      {
        category,
        description: description.trim(),
        reportedUserId: params?.reportedUserId,
        jobId: params?.jobId,
      },
      {
        onSuccess: () => {
          toast.success('Report submitted. Our team will review it.');
          navigation.goBack();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not submit.'),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Report a Concern</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card padded style={styles.notice}>
          <View style={styles.noticeRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.tertiary} />
            <Text variant="caption" color="textSecondary" style={styles.noticeText}>
              Reports are confidential. If anyone is in immediate danger, contact
              local emergency services first.
            </Text>
          </View>
        </Card>

        <Text variant="labelMd" color="textSecondary" style={styles.label}>
          WHAT HAPPENED?
        </Text>
        <View style={styles.wrapRow}>
          {CATEGORY_KEYS.map((key) => (
            <Chip
              key={key}
              label={REPORT_CATEGORIES[key]}
              selected={category === key}
              onPress={() => setCategory(key)}
              style={styles.chip}
            />
          ))}
        </View>

        <Input
          label="Tell us more"
          placeholder="Describe what happened, with as much detail as you're comfortable sharing…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          style={styles.multiline}
          containerStyle={styles.field}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Submit Report"
          icon="flag"
          onPress={submit}
          disabled={!category || description.trim().length < 5}
          loading={createReport.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  notice: {
    marginBottom: spacing.md,
    backgroundColor: colors.successSoft,
    borderColor: '#bbf7d0',
  },
  noticeRow: { flexDirection: 'row', gap: spacing.base },
  noticeText: { flex: 1 },
  label: { marginBottom: spacing.base },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: { marginRight: spacing.base, marginBottom: spacing.base },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
