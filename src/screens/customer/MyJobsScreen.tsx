/**
 * My Jobs — list of the jobs the current user has posted (customer Jobs tab).
 *
 * `embedded` drops the SafeAreaView and the section header so MyListingsScreen
 * can push the same list under its own header without a doubled title or a
 * second top inset.
 */

import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { Button, EmptyState, SectionHeader } from '@/components/ui';
import { JobListItem } from '@/components/job/JobListItem';
import { useMyJobs } from '@/hooks';
import { Job } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export interface MyJobsScreenProps {
  embedded?: boolean;
}

export function MyJobsScreen({ embedded }: MyJobsScreenProps = {}) {
  const navigation = useNavigation<Nav>();
  const { data: jobs, isLoading } = useMyJobs();

  const list = (
    <FlatList
        data={jobs ?? []}
        keyExtractor={(job: Job) => job.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={embedded ? null : <SectionHeader title="My Jobs" />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="clipboard-outline"
              title="No jobs yet"
              message="Post a job to start getting help from trusted neighbors."
              actionLabel="Post a Job"
              onAction={() => navigation.navigate('CreateJob')}
            />
          ) : null
        }
        renderItem={({ item: job }) => (
          <JobListItem
            job={job}
            onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
          />
        )}
        ListFooterComponent={
          jobs && jobs.length > 0 ? (
            <View style={styles.footer}>
              <Button
                title="Post a New Job"
                icon="add"
                onPress={() => navigation.navigate('CreateJob')}
              />
            </View>
          ) : null
        }
    />
  );

  if (embedded) return list;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {list}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
  footer: { marginTop: spacing.md },
});
