/**
 * The signed-in person's answer to the AI notice, and a way to change it.
 *
 * Also keeps services/aiPermission in step with that answer, which is what
 * the AI service actually checks before any network call. Mounted app-wide by
 * MainTabs, so the flag is right before any screen can ask for AI.
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/services';
import { setAiPermitted } from '@/services/aiPermission';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

export function useAiConsent() {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useQuery({
    queryKey: queryKeys.aiConsent(userId ?? 'signed-out'),
    queryFn: () => backend.getAiConsent(),
    enabled: !!userId,
  });

  const granted = !!userId && query.data === true;
  useEffect(() => {
    setAiPermitted(granted);
  }, [granted]);

  return {
    /** true / false once answered; null if never asked; undefined while loading. */
    consent: userId ? query.data : undefined,
    granted,
    /** Loaded, and this account has never answered: time to ask. */
    needsAnswer: !!userId && query.isSuccess && query.data === null,
  };
}

export function useSetAiConsent() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (granted: boolean) => backend.setAiConsent(granted),
    onSuccess: (_void, granted) => {
      if (!userId) return;
      // Applies immediately; no refetch needed for the answer just given.
      setAiPermitted(granted);
      qc.setQueryData(queryKeys.aiConsent(userId), granted);
    },
  });
}
