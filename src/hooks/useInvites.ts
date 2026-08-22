/**
 * Job invite hooks — the safety-preserving alternative to contacting a
 * recommended helper directly. An invite carries no contact information; it
 * only points the helper at an open listing they can apply to normally.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, InviteHelperInput } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useMyInvites() {
  return useQuery({
    queryKey: queryKeys.myInvites,
    queryFn: () => backend.listMyInvites(),
  });
}

export function useJobInvites(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobInvites(jobId),
    queryFn: () => backend.listInvitesForJob(jobId),
    enabled: !!jobId,
  });
}

export function useInviteHelper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteHelperInput) => backend.inviteHelper(input),
    onSuccess: (invite) => {
      qc.invalidateQueries({ queryKey: queryKeys.jobInvites(invite.jobId) });
      qc.invalidateQueries({ queryKey: queryKeys.myInvites });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
