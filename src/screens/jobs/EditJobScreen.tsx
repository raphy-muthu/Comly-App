/**
 * Edit Job — owner edits an existing listing. Open jobs are fully editable;
 * accepted jobs allow limited edits (schedule/description) since a helper has
 * already committed based on the original terms.
 */

import { useEffect, useState } from 'react';
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
import { useJob, useUpdateJob } from '@/hooks';
import {
  CommunityTag,
  COMMUNITY_TAGS,
  EquipmentStatus,
  EQUIPMENT_LABELS,
  PayType,
} from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'EditJob'>;

const TAG_KEYS = Object.keys(COMMUNITY_TAGS) as CommunityTag[];

export function EditJobScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { data: job } = useJob(params.jobId);
  const updateJob = useUpdateJob();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pay, setPay] = useState('');
  const [payType, setPayType] = useState<PayType>('fixed');
  const [scheduledFor, setScheduledFor] = useState('');
  const [equipment, setEquipment] = useState<EquipmentStatus>('not_needed');
  const [equipmentDetails, setEquipmentDetails] = useState('');
  const [tags, setTags] = useState<Set<CommunityTag>>(new Set());
  const [seeded, setSeeded] = useState(false);

  // Seed form once the job loads.
  useEffect(() => {
    if (!job || seeded) return;
    setTitle(job.title);
    setDescription(job.description);
    setPay(String(job.pay));
    setPayType(job.payType);
    setScheduledFor(job.scheduledFor);
    setEquipment(job.equipmentStatus);
    setEquipmentDetails(job.equipmentDetails ?? '');
    setTags(new Set(job.communityTags));
    setSeeded(true);
  }, [job, seeded]);

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text variant="bodyMd" color="textSecondary">
            Loading…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Accepted jobs: a helper already committed — restrict edits to logistics.
  const limited = job.status === 'accepted' || job.status === 'in_progress';

  const toggleTag = (t: CommunityTag) =>
    setTags((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const save = () => {
    updateJob.mutate(
      {
        id: job.id,
        patch: limited
          ? { description: description.trim(), scheduledFor: scheduledFor.trim() }
          : {
              title: title.trim(),
              description: description.trim(),
              pay: Number(pay) || job.pay,
              payType,
              scheduledFor: scheduledFor.trim(),
              equipmentStatus: equipment,
              equipmentDetails: equipmentDetails.trim() || undefined,
              communityTags: Array.from(tags),
            },
      },
      {
        onSuccess: () => {
          toast.success('Listing updated.');
          navigation.goBack();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not save.'),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Edit Listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {limited && (
          <Card padded style={styles.limitedCard}>
            <View style={styles.limitedRow}>
              <Ionicons name="information-circle" size={18} color={colors.secondary} />
              <Text variant="caption" color="textSecondary" style={styles.limitedText}>
                A helper has been accepted, so only the description and schedule
                can change. They'll see your updates.
              </Text>
            </View>
          </Card>
        )}

        {!limited && (
          <Input
            label="Job Title"
            value={title}
            onChangeText={setTitle}
            containerStyle={styles.field}
          />
        )}

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
          containerStyle={styles.field}
        />

        <Input
          label="Schedule"
          placeholder="e.g. Saturday morning"
          value={scheduledFor}
          onChangeText={setScheduledFor}
          icon="calendar-outline"
          containerStyle={styles.field}
        />

        {!limited && (
          <>
            <View style={styles.payRow}>
              <Input
                label="Pay"
                value={pay}
                onChangeText={(t) => setPay(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                icon="cash-outline"
                containerStyle={{ flex: 1 }}
              />
              <View style={styles.payToggle}>
                {(['fixed', 'hourly'] as PayType[]).map((t) => (
                  <Chip
                    key={t}
                    label={t === 'fixed' ? 'Fixed' : 'Per hour'}
                    selected={payType === t}
                    onPress={() => setPayType(t)}
                  />
                ))}
              </View>
            </View>

            <Text variant="labelMd" color="textSecondary" style={styles.label}>
              EQUIPMENT
            </Text>
            <View style={styles.wrapRow}>
              {(Object.keys(EQUIPMENT_LABELS) as EquipmentStatus[]).map((e) => (
                <Chip
                  key={e}
                  label={EQUIPMENT_LABELS[e]}
                  selected={equipment === e}
                  onPress={() => setEquipment(e)}
                  style={styles.mrb}
                />
              ))}
            </View>
            {(equipment === 'yes' || equipment === 'some') && (
              <Input
                placeholder="What's provided?"
                value={equipmentDetails}
                onChangeText={setEquipmentDetails}
                containerStyle={styles.field}
              />
            )}

            <Text variant="labelMd" color="textSecondary" style={styles.label}>
              COMMUNITY TAGS
            </Text>
            <View style={styles.wrapRow}>
              {TAG_KEYS.map((t) => (
                <Chip
                  key={t}
                  label={COMMUNITY_TAGS[t].label}
                  icon={COMMUNITY_TAGS[t].icon as any}
                  tone="success"
                  selected={tags.has(t)}
                  onPress={() => toggleTag(t)}
                  style={styles.mrb}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save Changes" onPress={save} loading={updateJob.isPending} />
      </View>
    </SafeAreaView>
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
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  limitedCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoSoft,
  },
  limitedRow: { flexDirection: 'row', gap: spacing.base },
  limitedText: { flex: 1 },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  payRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  payToggle: { flexDirection: 'row', gap: spacing.base, paddingBottom: 4 },
  label: { marginBottom: spacing.base },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  mrb: { marginRight: spacing.base, marginBottom: spacing.base },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
