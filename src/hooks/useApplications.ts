/**
 * Application data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplyToJobInput, backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useJobApplications(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobApplications(jobId),
    queryFn: () => backend.listApplicationsForJob(jobId),
    enabled: !!jobId,
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: queryKeys.myApplications,
    queryFn: () => backend.listMyApplications(),
  });
}

export function useApplyToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyToJobInput) => backend.applyToJob(input),
    onSuccess: (_app, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobApplications(input.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.job(input.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.feedJobs });
      qc.invalidateQueries({ queryKey: queryKeys.myApplications });
    },
  });
}

function useApplicationDecision(
  fn: (jobId: string, applicationId: string) => Promise<void>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, applicationId }: { jobId: string; applicationId: string }) =>
      fn(jobId, applicationId),
    onSuccess: (_r, { jobId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobApplications(jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.job(jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.myJobs });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useAcceptApplication() {
  return useApplicationDecision((j, a) => backend.acceptApplication(j, a));
}

export function useDeclineApplication() {
  return useApplicationDecision((j, a) => backend.declineApplication(j, a));
}
