/**
 * Review hooks. Reviews are only creatable on a completed job by one of its two
 * parties — the backend enforces that; these just wire the UI to it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, CreateReviewInput } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useJobReviews(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobReviews(jobId),
    queryFn: () => backend.listReviewsForJob(jobId),
    enabled: !!jobId,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => backend.createReview(input),
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobReviews(review.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.userReviews(review.revieweeId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile(review.revieweeId) });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
