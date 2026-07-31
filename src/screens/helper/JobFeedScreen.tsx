/**
 * Job Feed — nearby jobs for helpers, with a search field and filter chips
 * (Nearby / Highest Pay / Quick Jobs / Teen Safe). Filtering and sorting are
 * applied client-side over the fetched feed.
 */

import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/theme';
import { Chip, EmptyState, Text } from '@/components/ui';
import { JobCard } from '@/components/job/JobCard';
import { useFeedJobs } from '@/hooks';
import { Job, JOB_CATEGORIES } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type Filter =
  | 'nearby'
  | 'highest_pay'
  | 'quick'
  | 'teen_safe'
  | 'senior_help'
  | 'student_friendly';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'nearby', label: 'Nearby' },
  { key: 'highest_pay', label: 'Highest Pay' },
  { key: 'quick', label: 'Quick Jobs' },
  { key: 'teen_safe', label: 'Teen Safe' },
  { key: 'senior_help', label: 'Senior Help' },
  { key: 'student_friendly', label: 'Student-Friendly' },
];

const isQuick = (j: Job) =>
  /30 min|under 1 hour/i.test(j.estimatedDuration);

export function JobFeedScreen() {
  const navigation = useNavigation<Nav>();
  const { data: jobs, isLoading, refetch, isRefetching } = useFeedJobs();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('nearby');

  const visible = useMemo(() => {
    let list = [...(jobs ?? [])];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.neighborhood.toLowerCase().includes(q) ||
          JOB_CATEGORIES[j.category].label.toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case 'highest_pay':
        list.sort((a, b) => b.pay - a.pay);
        break;
      case 'quick':
        list = list.filter(isQuick);
        break;
      case 'teen_safe':
        list = list.filter((j) => j.safetyTier === 'teen_safe');
        break;
      case 'senior_help':
        list = list.filter((j) => j.communityTags.includes('senior_help'));
        break;
      case 'student_friendly':
        list = list.filter((j) => j.communityTags.includes('student_friendly'));
        break;
      case 'nearby':
      default:
        list.sort((a, b) => a.distanceMiles - b.distanceMiles);
    }
    return list;
  }, [jobs, query, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.outline} />
          <TextInput
            placeholder="Search jobs nearby…"
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
          <Ionicons name="options-outline" size={20} color={colors.outline} />
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            style={styles.filterChip}
          />
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {!isLoading && visible.length === 0 && (
          <EmptyState
            icon="search-outline"
            title="No matching jobs"
            message="Try a different filter or search term."
          />
        )}
        {visible.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
    gap: spacing.base,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.bodyMd,
  },
  filters: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    gap: spacing.base,
  },
  filterChip: { marginRight: spacing.base },
  list: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
});
