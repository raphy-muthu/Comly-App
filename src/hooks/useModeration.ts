/**
 * Blocking hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: () => backend.listBlockedUserIds(),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => backend.blockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blockedUsers });
      qc.invalidateQueries({ queryKey: queryKeys.recommendedHelpers });
      qc.invalidateQueries({ queryKey: queryKeys.feedJobs });
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
