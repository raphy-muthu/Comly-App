/**
 * Report hooks — creating reports, viewing your own, and admin moderation.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, CreateReportInput } from '@/services';
import { Report } from '@/types/domain';
import { queryKeys } from '@/lib/queryClient';

export function useMyReports() {
  return useQuery({
    queryKey: queryKeys.myReports,
    queryFn: () => backend.listMyReports(),
  });
}

export function useAllReports() {
  return useQuery({
    queryKey: queryKeys.allReports,
    queryFn: () => backend.listAllReports(),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) => backend.createReport(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myReports });
      qc.invalidateQueries({ queryKey: queryKeys.allReports });
    },
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: Report['status']; adminNotes?: string };
    }) => backend.updateReport(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.allReports });
      qc.invalidateQueries({ queryKey: queryKeys.myReports });
    },
  });
}
