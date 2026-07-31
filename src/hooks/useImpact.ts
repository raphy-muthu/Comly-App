/**
 * Community impact stats hook.
 */

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services';
import { queryKeys } from '@/lib/queryClient';

export function useImpactStats() {
  return useQuery({
    queryKey: queryKeys.impactStats,
    queryFn: () => backend.getImpactStats(),
  });
}
