/**
 * Profile / helper data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services';
import { UserProfile } from '@/types/domain';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

export function useProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.profile(id),
    queryFn: () => backend.getProfile(id),
    enabled: !!id,
  });
}

export function useRecommendedHelpers() {
  return useQuery({
    queryKey: queryKeys.recommendedHelpers,
    queryFn: () => backend.listRecommendedHelpers(),
  });
}

export function useUserReviews(id: string) {
  return useQuery({
    queryKey: queryKeys.userReviews(id),
    queryFn: () => backend.listReviewsForUser(id),
    enabled: !!id,
  });
}

/** Saves profile edits and syncs the auth store so the UI updates instantly. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => backend.updateProfile(patch),
    onSuccess: (user) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
    },
  });
}
