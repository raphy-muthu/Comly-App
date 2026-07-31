/**
 * Support ticket hooks — submitting tickets, viewing your own, admin queue.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend, CreateSupportTicketInput } from '@/services';
import { SupportTicket } from '@/types/domain';
import { queryKeys } from '@/lib/queryClient';

export function useMySupportTickets() {
  return useQuery({
    queryKey: queryKeys.mySupportTickets,
    queryFn: () => backend.listMySupportTickets(),
  });
}

export function useAllSupportTickets() {
  return useQuery({
    queryKey: queryKeys.allSupportTickets,
    queryFn: () => backend.listAllSupportTickets(),
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) =>
      backend.createSupportTicket(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mySupportTickets });
      qc.invalidateQueries({ queryKey: queryKeys.allSupportTickets });
    },
  });
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportTicket['status'] }) =>
      backend.updateSupportTicket(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.allSupportTickets });
      qc.invalidateQueries({ queryKey: queryKeys.mySupportTickets });
    },
  });
}
