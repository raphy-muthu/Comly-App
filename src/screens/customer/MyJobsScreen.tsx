/**
 * My Jobs — list of the jobs the current user has posted (customer Jobs tab).
 */

import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { spacing } from '@/theme';
import { Button, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { JobListItem } from '@/components/job/JobListItem';
import { useMyJobs } from '@/hooks';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function MyJobsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: jobs, isLoading } = useMyJobs();

  return (
    <Screen scroll>
      <SectionHeader title="My Jobs" />

      {!isLoading && jobs && jobs.length === 0 && (
        <EmptyState
          icon="clipboard-outline"
          title="No jobs yet"
          message="Post a job to start getting help from trusted neighbors."
          actionLabel="Post a Job"
          onAction={() => navigation.navigate('CreateJob')}
        />
      )}

      {jobs?.map((job) => (
        <JobListItem
          key={job.id}
          job={job}
          onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
        />
      ))}

      {jobs && jobs.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="Post a New Job"
            icon="add"
            onPress={() => navigation.navigate('CreateJob')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing.md },
});
