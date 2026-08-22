/**
 * Mutual job-completion hooks.
 *
 * Completion is two-sided: the customer requests it (job → pending_confirmation)
 * and the accepted helper confirms or disputes it. Every mutation invalidates
 * the same set so both sides' dashboards, the job detail screen, and the alerts
 * badge stay in step.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';

function useCompletionInvalidation() {
  const qc = useQueryClient();
  return (jobId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.job(jobId) });
    qc.invalidateQueries({ queryKey: queryKeys.myJobs });
    qc.invalidateQueries({ queryKey: queryKeys.feedJobs });
    qc.invalidateQueries({ queryKey: queryKeys.myApplications });
    qc.invalidateQueries({ queryKey: queryKeys.notifications });
  };
}

export function useRequestJobCompletion() {
  const invalidate = useCompletionInvalidation();
  return useMutation({
    mutationFn: (jobId: string) => backend.requestJobCompletion(jobId),
    onSuccess: (job) => invalidate(job.id),
  });
}

export function useConfirmJobCompletion() {
  const invalidate = useCompletionInvalidation();
  return useMutation({
    mutationFn: (jobId: string) => backend.confirmJobCompletion(jobId),
    onSuccess: (job) => invalidate(job.id),
  });
}

export function useDisputeJobCompletion() {
  const invalidate = useCompletionInvalidation();
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      backend.disputeJobCompletion(jobId, reason),
    onSuccess: (job) => invalidate(job.id),
  });
}
