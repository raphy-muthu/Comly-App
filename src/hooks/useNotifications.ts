/**
 * Notification data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => backend.listNotifications(),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
