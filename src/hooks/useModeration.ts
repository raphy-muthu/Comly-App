/**
 * Blocking hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import type { Application, Job, Review, UserProfile } from '@/types/domain';

export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: () => backend.listBlockedUserIds(),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, jobId }: { userId: string; jobId?: string }) =>
      backend.blockUser(userId, { jobId }),
    // Their content leaves the screen the moment the block is confirmed
    // (guideline 1.2), not after the refetch below comes back.
    onMutate: ({ userId }) => {
      qc.setQueryData<string[]>(queryKeys.blockedUsers, (ids) =>
        ids?.includes(userId) ? ids : [...(ids ?? []), userId]
      );
      qc.setQueryData<Job[]>(queryKeys.feedJobs, (jobs) =>
        jobs?.filter((j) => j.customerId !== userId)
      );
      qc.setQueryData<UserProfile[]>(queryKeys.recommendedHelpers, (people) =>
        people?.filter((p) => p.id !== userId)
      );
      qc.setQueriesData<Application[]>({ queryKey: ['applications'] }, (apps) =>
        Array.isArray(apps) ? apps.filter((a) => a.helperId !== userId) : apps
      );
      qc.setQueriesData<Review[]>({ queryKey: ['reviews'] }, (reviews) =>
        Array.isArray(reviews) ? reviews.filter((r) => r.reviewerId !== userId) : reviews
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blockedUsers });
      qc.invalidateQueries({ queryKey: queryKeys.recommendedHelpers });
      qc.invalidateQueries({ queryKey: queryKeys.feedJobs });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: queryKeys.myReports });
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => backend.unblockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blockedUsers });
    },
  });
}
