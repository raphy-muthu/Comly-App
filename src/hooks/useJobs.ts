/**
 * Job data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, CreateJobInput, JobUpdateInput } from '@/services';
import { JobStatus } from '@/types/domain';
import { queryKeys } from '@/lib/queryClient';

export function useFeedJobs() {
  return useQuery({
    queryKey: queryKeys.feedJobs,
    queryFn: () => backend.listFeedJobs(),
  });
}

export function useMyJobs() {
  return useQuery({
    queryKey: queryKeys.myJobs,
    queryFn: () => backend.listMyJobs(),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: () => backend.getJob(id),
    enabled: !!id,
  });
}

/**
 * The other party's contact card for an accepted job. The backend only returns
 * data to the job's matched pair (RPC-enforced in production), so `enabled`
 * is just a fetch-avoidance nicety, not the security boundary.
 */
export function useJobContact(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.jobContact(id),
    queryFn: () => backend.getJobContact(id),
    enabled: !!id && enabled,
  });
}

function useJobInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.myJobs });
    qc.invalidateQueries({ queryKey: queryKeys.feedJobs });
  };
}

export function useCreateJob() {
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: (input: CreateJobInput) => backend.createJob(input),
    onSuccess: invalidate,
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobUpdateInput }) =>
      backend.updateJob(id, patch),
    onSuccess: (job) => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.job(job.id) });
    },
  });
}

export function useSetJobStatus() {
  const qc = useQueryClient();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      backend.setJobStatus(id, status),
    onSuccess: (job) => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.job(job.id) });
    },
  });
}

export function useDeleteJob() {
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: (id: string) => backend.deleteJob(id),
    onSuccess: invalidate,
  });
}
