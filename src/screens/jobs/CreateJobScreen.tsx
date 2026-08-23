/**
 * Create Job — two experiences sharing one backend:
 *
 *  • Standard (3-step): Details → AI Preview → Review. Full controls: preset +
 *    custom categories, date/time, duration presets + custom, equipment,
 *    community tags, fair-pay guidance with low-pay warning, AI safety preview.
 *  • Senior Help Mode (route param seniorMode): a simplified single screen with
 *    large task presets, optional family contact, and plain language.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gradients, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Chip,
  DateTimeField,
  IconButton,
  Input,
  Text,
  useToast,
} from '@/components/ui';
import { SafetyBadge } from '@/components/trust';
import { useCreateJob } from '@/hooks';
import { ai, PaySuggestion, SafetyResult } from '@/services/ai';
import {
  CommunityTag,
  COMMUNITY_TAGS,
  EquipmentStatus,
  EQUIPMENT_LABELS,
  JobCategory,
  JOB_CATEGORIES,
  PayType,
  SafetyTier,
} from '@/types/domain';
import { useAuthStore } from '@/stores/authStore';
import { formatPayShort } from '@/lib/format';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'CreateJob'>;

const CATEGORY_KEYS = Object.keys(JOB_CATEGORIES) as JobCategory[];
const TAG_KEYS = Object.keys(COMMUNITY_TAGS) as CommunityTag[];

const DURATIONS: { label: string; minutes: number }[] = [
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: 'Half day', minutes: 240 },
  { label: 'Full day', minutes: 480 },
];

function scheduleLabel(date: Date | null, time: Date | null, flexible: boolean) {
  if (flexible || (!date && !time)) return 'Flexible';
  const parts: string[] = [];
  if (date)
    parts.push(
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    );
  if (time)
    parts.push(
      time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  return parts.join(', ');
}

export function CreateJobScreen() {
  const { params } = useRoute<Rt>();
  if (params?.seniorMode) return <SeniorFlow />;
  return <StandardFlow />;
}

// ════════════════════════════════════════════════════════════════════════════
// Standard 3-step flow
// ════════════════════════════════════════════════════════════════════════════
type Step = 'details' | 'ai' | 'review';
const STEPS: Step[] = ['details', 'ai', 'review'];

function StandardFlow() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const createJob = useCreateJob();
  const toast = useToast();

  const [step, setStep] = useState<Step>('details');

  const [category, setCategory] = useState<JobCategory>('snow_removal');
  const [customCategory, setCustomCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [flexible, setFlexible] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [durationLabel, setDurationLabel] = useState('1 hour');
  const [customDuration, setCustomDuration] = useState('');
  const [location, setLocation] = useState(user?.neighborhood ?? '');
  const [equipment, setEquipment] = useState<EquipmentStatus>('not_needed');
  const [equipmentDetails, setEquipmentDetails] = useState('');
  const [tags, setTags] = useState<Set<CommunityTag>>(new Set());
  const [pay, setPay] = useState('');
  const [payType, setPayType] = useState<PayType>('fixed');

  const [paySuggestion, setPaySuggestion] = useState<PaySuggestion | null>(null);
  const [safety, setSafety] = useState<SafetyResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [improving, setImproving] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const canContinue = title.trim().length > 2 && location.trim().length > 0;

  // Guards the payType-refetch effect below from also firing on the very
  // first entry into this step, which the combined fetch already covers.
  const hasFetchedAiRef = useRef(false);

  useEffect(() => {
    if (step !== 'ai') return;
    let active = true;
    setAiLoading(true);
    Promise.all([
      ai.suggestPay(category, title, payType),
      ai.safetyReview(title, description),
    ])
      .then(([p, s]) => {
        if (!active) return;
        setPaySuggestion(p);
        setSafety(s);
        if (!pay) setPay(String(p.recommended));
        hasFetchedAiRef.current = true;
      })
      .catch(() => {
        // Without this the Continue button stays disabled forever on a failed
        // review, stranding the user mid-flow with no way back or forward.
        if (!active) return;
        toast.error('Could not run the AI review. You can still post — a human will re-check the safety label.');
      })
      .finally(() => {
        if (active) setAiLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The Fixed/Per-hour toggle lives on this same step, after the suggestion
  // above has already been fetched — so without this, switching it left the
  // displayed range (and its "$X-Y" rationale text) stuck on whichever type
  // was selected at the moment the step was first entered. Refetches just the
  // pay suggestion, not the safety review, since payType has no bearing on
  // whether a task is safe.
  useEffect(() => {
    if (step !== 'ai' || !hasFetchedAiRef.current) return;
    let active = true;
    ai.suggestPay(category, title, payType).then((p) => {
      if (active) setPaySuggestion(p);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payType]);

  const improveDescription = async () => {
    setImproving(true);
    try {
      setDescription(await ai.improveDescription(description, category));
    } catch {
      toast.error('Could not rewrite the description. Your text is unchanged.');
    } finally {
      setImproving(false);
    }
  };

  const toggleTag = (t: CommunityTag) =>
    setTags((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const payNum = Number(pay) || 0;
  const lowPay = !!paySuggestion && payNum > 0 && payNum < paySuggestion.min;

  const post = () => {
    createJob.mutate(
      {
        category,
        customCategoryText: category === 'other' ? customCategory.trim() : undefined,
        title: title.trim(),
        description: description.trim(),
        pay: payNum || paySuggestion?.recommended || 0,
        payType,
        neighborhood: location.trim(),
        scheduledFor: scheduleLabel(date, time, flexible),
        isTimeFlexible: flexible,
        durationMinutes,
        estimatedDuration: durationLabel,
        // If the review never returned, fall back to 'caution', not
        // 'teen_safe'. Both let a teen apply, but 'teen_safe' is a positive
        // claim that this task is appropriate for a minor — never assert that
        // on the strength of a request that failed.
        safetyTier: (safety?.tier ?? 'caution') as SafetyTier,
        safetyNotes: safety?.note ?? 'Awaiting safety review.',
        requiresAdultSupervision: safety?.tier === 'adult_supervision',
        equipmentStatus: equipment,
        equipmentDetails: equipmentDetails.trim() || undefined,
        communityTags: Array.from(tags),
      },
      {
        onSuccess: () => {
          toast.success('Job posted!');
          navigation.goBack();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Could not post job.'),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton
          icon={step === 'details' ? 'close' : 'arrow-back'}
          onPress={() =>
            step === 'details'
              ? navigation.goBack()
              : setStep(STEPS[stepIndex - 1])
          }
        />
        <Text variant="headlineMd">
          {step === 'details' ? 'Job Details' : step === 'ai' ? 'AI Preview' : 'Review'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((stepIndex + 1) / STEPS.length) * 100}%` },
          ]}
        />
      </View>
      <Text variant="labelMd" color="textSecondary" style={styles.stepLabel}>
        Step {stepIndex + 1} of {STEPS.length}
      </Text>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'details' && (
          <View>
            <FieldLabel>CATEGORY</FieldLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
            >
              {CATEGORY_KEYS.map((key) => (
                <Chip
                  key={key}
                  label={JOB_CATEGORIES[key].label}
                  icon={JOB_CATEGORIES[key].icon as any}
                  selected={category === key}
                  onPress={() => setCategory(key)}
                  style={styles.mr}
                />
              ))}
            </ScrollView>
            {category === 'other' && (
              <Input
                placeholder="Name your category (e.g. Backyard cleanup)"
                value={customCategory}
                onChangeText={setCustomCategory}
                containerStyle={styles.field}
              />
            )}

            <Input
              label="Job Title"
              placeholder="e.g., Shovel 2-car driveway"
              value={title}
              onChangeText={setTitle}
              containerStyle={styles.field}
            />

            <View style={styles.field}>
              <View style={styles.descHeader}>
                <Text variant="labelMd" color="textSecondary">
                  Description
                </Text>
                <Pressable onPress={improveDescription} hitSlop={8} style={styles.aiInline}>
                  <Ionicons name="sparkles" size={14} color={colors.secondary} />
                  <Text variant="labelMd" color="textLink" style={{ marginLeft: 4 }}>
                    {improving ? 'Improving…' : 'AI improve'}
                  </Text>
                </Pressable>
              </View>
              <Input
                placeholder="Describe what needs to be done…"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                style={styles.multiline}
              />
            </View>

            <Card style={styles.field} padded>
              <FieldLabel>SCHEDULE</FieldLabel>
              {/* Stacked, not side-by-side: iOS's native spinner picker renders
                  at its own intrinsic width regardless of the parent's flex
                  constraint, so two half-width columns caused the open picker
                  to overlap its sibling and run off the right edge of the
                  screen. Full-width stacking (matching Senior Mode's
                  single-column usage, which never had this bug) gives each
                  picker the room it actually needs. */}
              <View style={styles.scheduleRow}>
                <DateTimeField label="Date" mode="date" value={date} onChange={setDate} />
              </View>
              <View style={styles.scheduleRow}>
                <DateTimeField label="Time" mode="time" value={time} onChange={setTime} />
              </View>
              <Pressable style={styles.flexToggle} onPress={() => setFlexible((f) => !f)}>
                <Ionicons
                  name={flexible ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={flexible ? colors.primary : colors.outline}
                />
                <Text variant="bodyMd" style={{ marginLeft: spacing.base }}>
                  Timing is flexible
                </Text>
              </Pressable>

              <FieldLabel>ESTIMATED DURATION</FieldLabel>
              <View style={styles.wrapRow}>
                {DURATIONS.map((d) => (
                  <Chip
                    key={d.label}
                    label={d.label}
                    selected={durationLabel === d.label}
                    onPress={() => {
                      setDurationLabel(d.label);
                      setDurationMinutes(d.minutes);
                    }}
                    style={styles.mrb}
                  />
                ))}
                <Chip
                  label="Custom"
                  selected={durationLabel === 'Custom'}
                  onPress={() => setDurationLabel('Custom')}
                  style={styles.mrb}
                />
              </View>
              {durationLabel === 'Custom' && (
                <Input
                  placeholder="Minutes (e.g. 75)"
                  keyboardType="number-pad"
                  value={customDuration}
                  onChangeText={(t) => {
                    const v = t.replace(/[^0-9]/g, '');
                    setCustomDuration(v);
                    setDurationMinutes(Number(v) || 0);
                  }}
                  containerStyle={styles.topGap}
                />
              )}
            </Card>

            <Card style={styles.field} padded>
              <FieldLabel>EQUIPMENT</FieldLabel>
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
                  placeholder="What's provided? (e.g. shovel and salt)"
                  value={equipmentDetails}
                  onChangeText={setEquipmentDetails}
                  containerStyle={styles.topGap}
                />
              )}
            </Card>

            <FieldLabel>COMMUNITY TAGS (OPTIONAL)</FieldLabel>
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

            <Input
              label="Location Area"
              placeholder="Search neighborhood (e.g. Bryn Mawr)"
              value={location}
              onChangeText={setLocation}
              icon="location-outline"
              containerStyle={styles.locationField}
            />
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={12} color={colors.outline} />
              <Text variant="caption" color="outline" style={{ marginLeft: 4 }}>
                Exact address hidden until the job is accepted
              </Text>
            </View>
          </View>
        )}

        {step === 'ai' && (
          <View>
            <LinearGradient
              colors={gradients.leaf}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.assistantCard}
            >
              <View style={styles.assistantHeader}>
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLg" color="onPrimary" style={{ fontWeight: '700' }}>
                    AI Job Assistant
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {aiLoading
                      ? 'Analyzing your job…'
                      : 'Here are suggestions for fair pay and safety.'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <Text variant="caption" color="textSecondary" style={styles.fairNote}>
              Comly encourages fair pay for local helpers. AI suggestions are
              based on task type, time, difficulty, and equipment needs.
            </Text>

            <Card style={styles.insightCard} padded>
              <View style={styles.insightRow}>
                <View style={styles.insightIcon}>
                  <Ionicons name="pricetag" size={16} color={colors.primary} />
                </View>
                <Text variant="bodyMd" style={styles.insightText}>
                  {paySuggestion ? (
                    <>
                      Suggested pay:{' '}
                      <Text variant="bodyMd" color="secondary" style={{ fontWeight: '700' }}>
                        ${paySuggestion.min}–${paySuggestion.max}
                      </Text>
                      {'. '}
                      {paySuggestion.rationale}
                    </>
                  ) : (
                    'Calculating a fair pay range…'
                  )}
                </Text>
              </View>
            </Card>

            <Card style={styles.insightCard} padded>
              <View style={styles.insightRow}>
                <View
                  style={[
                    styles.insightIcon,
                    { backgroundColor: safety?.safe === false ? colors.errorContainer : colors.successSoft },
                  ]}
                >
                  <Ionicons
                    name={safety?.safe === false ? 'warning' : 'shield-checkmark'}
                    size={16}
                    color={safety?.safe === false ? colors.error : colors.tertiary}
                  />
                </View>
                <View style={styles.insightText}>
                  <Text variant="bodyMd">{safety ? safety.note : 'Running a safety check…'}</Text>
                  {safety && (
                    <View style={styles.safetyBadgeRow}>
                      <SafetyBadge tier={safety.tier} />
                    </View>
                  )}
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      toast.info('Thanks — our team will review this safety label.')
                    }
                  >
                    <Text variant="labelMd" color="textLink" style={styles.override}>
                      Looks wrong? Request review
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>

            <FieldLabel>SET YOUR PAY</FieldLabel>
            <View style={styles.payRow}>
              <Input
                placeholder="0"
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
            {lowPay && (
              <View style={styles.warnRow}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <Text variant="caption" color="warning" style={{ flex: 1, marginLeft: 6 }}>
                  This pay may be too low for the estimated work. Consider raising
                  it to attract reliable helpers and support fair compensation.
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 'review' && (
          <View>
            <Card rounded="xl" padded style={styles.field}>
              <View style={styles.reviewHeader}>
                <Chip
                  label={
                    category === 'other' && customCategory
                      ? customCategory
                      : JOB_CATEGORIES[category].label
                  }
                  tone="primary"
                />
                <SafetyBadge tier={(safety?.tier ?? 'teen_safe') as SafetyTier} />
              </View>
              <Text variant="headlineMd" style={styles.reviewTitle}>
                {title || 'Untitled job'}
              </Text>
              <Text variant="bodyMd" color="textSecondary">
                {description || 'No description provided.'}
              </Text>
              <View style={styles.reviewMeta}>
                <ReviewMeta icon="cash-outline" label={formatPayShort(payNum, payType)} />
                <ReviewMeta icon="time-outline" label={durationLabel} />
                <ReviewMeta icon="calendar-outline" label={scheduleLabel(date, time, flexible)} />
                <ReviewMeta icon="location-outline" label={location} />
                <ReviewMeta icon="construct-outline" label={EQUIPMENT_LABELS[equipment]} />
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step === 'details' && (
          <Button title="Continue" icon="arrow-forward" iconPosition="right" onPress={() => setStep('ai')} disabled={!canContinue} />
        )}
        {step === 'ai' && (
          <Button title="Continue to Review" icon="arrow-forward" iconPosition="right" onPress={() => setStep('review')} disabled={aiLoading} />
        )}
        {step === 'review' && (
          <Button title="Post Job" onPress={post} loading={createJob.isPending} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Senior Help Mode (simplified)
// ════════════════════════════════════════════════════════════════════════════
const SENIOR_PRESETS: { label: string; category: JobCategory; icon: string }[] = [
  { label: 'Shovel snow', category: 'snow_removal', icon: 'snow-outline' },
  { label: 'Carry groceries', category: 'errands', icon: 'cart-outline' },
  { label: 'Move boxes', category: 'moving_help', icon: 'cube-outline' },
  { label: 'Tech help', category: 'tech_help', icon: 'laptop-outline' },
  { label: 'Tutoring', category: 'tutoring', icon: 'school-outline' },
  { label: 'Yard cleanup', category: 'yard_work', icon: 'leaf-outline' },
  { label: 'Dog walking', category: 'dog_walking', icon: 'footsteps-outline' },
  { label: 'Water plants', category: 'plant_watering', icon: 'flower-outline' },
  { label: 'Basic cleaning', category: 'cleaning', icon: 'sparkles-outline' },
  { label: 'Other help', category: 'other', icon: 'ellipsis-horizontal-outline' },
];

function SeniorFlow() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const createJob = useCreateJob();
  const toast = useToast();

  const [preset, setPreset] = useState<(typeof SENIOR_PRESETS)[number] | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [pay, setPay] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyPhone, setFamilyPhone] = useState('');
  const [notifyFamily, setNotifyFamily] = useState(false);
  // Covers the async safety-review that runs BEFORE the mutation, so a rapid
  // double-tap can't create two listings.
  const [posting, setPosting] = useState(false);

  // Suggest pay when a preset is chosen.
  useEffect(() => {
    if (!preset) return;
    let active = true;
    // Senior Help Mode always posts a fixed price (createJob below hardcodes
    // payType: 'fixed'), so that's what's asked for here too.
    ai.suggestPay(preset.category, preset.label, 'fixed')
      .then((p) => {
        if (active && !pay) setPay(String(p.recommended));
      })
      .catch(() => {
        // A missing suggestion just means the field stays empty — the user
        // types their own amount. Nothing to surface.
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const post = async () => {
    if (!preset || posting) return;
    setPosting(true);
    // A thrown review would otherwise leave `posting` stuck true, permanently
    // disabling the only button on this screen. Seniors get the least
    // recoverable UI, so this flow must not dead-end.
    let safety: SafetyResult;
    try {
      safety = await ai.safetyReview(preset.label, '');
    } catch {
      safety = {
        safe: true,
        tier: 'caution',
        note: 'Awaiting safety review.',
      };
    }
    createJob.mutate(
      {
        category: preset.category,
        title: preset.label === 'Other help' ? 'Help needed' : preset.label,
        description: `Help requested with ${preset.label.toLowerCase()}.`,
        pay: Number(pay) || 0,
        payType: 'fixed',
        neighborhood: user?.neighborhood ?? '',
        scheduledFor: date
          ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : 'Flexible',
        isTimeFlexible: !date,
        estimatedDuration: '1 hour',
        safetyTier: safety.tier,
        requiresAdultSupervision: safety.tier === 'adult_supervision',
        equipmentStatus: 'not_needed',
        communityTags: ['senior_help'],
        createdWithSeniorMode: true,
        familyContact:
          familyName || familyPhone
            ? { name: familyName, phone: familyPhone, notify: notifyFamily }
            : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Your request was posted!');
          navigation.goBack();
        },
        onError: (err) => {
          setPosting(false);
          toast.error(err instanceof Error ? err.message : 'Could not post.');
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Get simple help</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.seniorScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="bodyLg" color="textSecondary" style={styles.seniorIntro}>
          Pick what you need help with. A trusted neighbor will reach out.
        </Text>

        <View style={styles.presetGrid}>
          {SENIOR_PRESETS.map((p) => {
            const selected = preset?.label === p.label;
            return (
              <Pressable
                key={p.label}
                style={[styles.presetCard, selected && styles.presetSelected]}
                onPress={() => setPreset(p)}
              >
                <Ionicons
                  name={p.icon as any}
                  size={36}
                  color={selected ? colors.primary : colors.outline}
                />
                <Text
                  variant="bodyLg"
                  color={selected ? 'primary' : 'textPrimary'}
                  center
                  style={styles.presetLabel}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {preset && (
          <>
            <View style={styles.seniorField}>
              <DateTimeField
                label="When? (optional)"
                mode="date"
                value={date}
                onChange={setDate}
                placeholder="Any day is fine"
              />
            </View>

            <View style={styles.seniorField}>
              <Input
                label="What would you like to pay?"
                placeholder="0"
                value={pay}
                onChangeText={(t) => setPay(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                icon="cash-outline"
                hint="We suggested a fair amount — change it anytime."
              />
            </View>

            <Card padded style={styles.seniorField}>
              <Text variant="bodyLg" style={styles.familyTitle}>
                Family contact (optional)
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.familyHint}>
                Private — only used to keep a loved one in the loop.
              </Text>
              <Input
                label="Name"
                placeholder="e.g. Robert"
                value={familyName}
                onChangeText={setFamilyName}
                containerStyle={styles.seniorInner}
              />
              <Input
                label="Phone"
                placeholder="(610) 555-0000"
                keyboardType="phone-pad"
                value={familyPhone}
                onChangeText={setFamilyPhone}
                containerStyle={styles.seniorInner}
              />
              <Pressable style={styles.flexToggle} onPress={() => setNotifyFamily((n) => !n)}>
                <Ionicons
                  name={notifyFamily ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={notifyFamily ? colors.primary : colors.outline}
                />
                <Text variant="bodyMd" style={{ marginLeft: spacing.base }}>
                  Notify them when someone accepts
                </Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Post Request"
          onPress={post}
          disabled={!preset}
          loading={posting || createJob.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="labelMd" color="textSecondary" style={styles.fieldLabel}>
      {children}
    </Text>
  );
}

function ReviewMeta({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.reviewMetaItem}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text variant="bodyMd" style={{ marginLeft: 6 }}>
        {label}
      </Text>
    </View>
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
  progressTrack: { height: 4, backgroundColor: colors.surfaceContainerHigh, marginTop: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.primary },
  stepLabel: { paddingHorizontal: spacing.marginMobile, marginTop: spacing.base },
  scroll: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.md, paddingBottom: spacing.xl },
  fieldLabel: { marginBottom: spacing.base, marginTop: spacing.base },
  field: { marginBottom: spacing.md },
  locationField: { marginBottom: spacing.md, marginTop: spacing.base },
  row: { gap: spacing.base, paddingBottom: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  mr: { marginRight: spacing.base },
  mrb: { marginRight: spacing.base, marginBottom: spacing.base },
  topGap: { marginTop: spacing.base },
  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  aiInline: { flexDirection: 'row', alignItems: 'center' },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  scheduleRow: { flexDirection: 'row', gap: spacing.sm },
  flexToggle: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', marginTop: -spacing.base, marginBottom: spacing.md },
  // AI step
  assistantCard: { borderRadius: radius.xl, padding: spacing.md },
  assistantHeader: { flexDirection: 'row', gap: spacing.sm },
  assistantAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fairNote: { marginTop: spacing.sm, marginBottom: spacing.sm },
  insightCard: { marginBottom: spacing.sm },
  insightRow: { flexDirection: 'row', gap: spacing.sm },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.base,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: { flex: 1 },
  safetyBadgeRow: { marginTop: spacing.base },
  override: { marginTop: spacing.base },
  payRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  payToggle: { flexDirection: 'row', gap: spacing.base, paddingTop: 4 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  // Review
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  reviewTitle: { marginBottom: spacing.base },
  reviewMeta: { marginTop: spacing.md, gap: spacing.sm },
  reviewMetaItem: { flexDirection: 'row', alignItems: 'center' },
  // Senior
  seniorScroll: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.md, paddingBottom: spacing.xl },
  seniorIntro: { marginBottom: spacing.md },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  presetCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    padding: spacing.base,
  },
  presetSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.successSoft },
  presetLabel: { marginTop: spacing.base },
  seniorField: { marginTop: spacing.md },
  seniorInner: { marginTop: spacing.sm },
  familyTitle: { fontWeight: '700' },
  familyHint: { marginTop: 2, marginBottom: spacing.sm },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
