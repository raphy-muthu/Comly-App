/**
 * No-show strike hooks.
 *
 * A report never applies a strike on its own — it lands as `pending` until an
 * admin confirms it. See NO_SHOW_POLICY in types/domain.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, ReportNoShowInput } from '@/services';
import { NoShowEvent } from '@/types/domain';
import { queryKeys } from '@/lib/queryClient';

export function useUserNoShows(userId: string) {
  return useQuery({
    queryKey: queryKeys.userNoShows(userId),
    queryFn: () => backend.listNoShowEventsForUser(userId),
    enabled: !!userId,
  });
}

export function useAllNoShows() {
  return useQuery({
    queryKey: queryKeys.allNoShows,
    queryFn: () => backend.listAllNoShowEvents(),
  });
}

export function useReportNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportNoShowInput) => backend.reportNoShow(input),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: queryKeys.userNoShows(event.reportedUserId) });
      qc.invalidateQueries({ queryKey: queryKeys.allNoShows });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useResolveNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminNotes,
    }: {
      id: string;
      status: NoShowEvent['status'];
      adminNotes?: string;
    }) => backend.resolveNoShowEvent(id, { status, adminNotes }),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: queryKeys.allNoShows });
      qc.invalidateQueries({ queryKey: queryKeys.userNoShows(event.reportedUserId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile(event.reportedUserId) });
    },
  });
}
