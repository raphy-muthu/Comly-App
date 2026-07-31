/**
 * Shared React Query client. Tuned for a mobile app: data stays fresh for a
 * short window and refetches on reconnect rather than on every focus.
 *
 * A global QueryCache onError surfaces failed background reads as a toast —
 * mutations handle their own errors at the call site, but without this a
 * failed feed/profile fetch would just render as silent empty UI.
 */

import { QueryCache, QueryClient } from '@tanstack/react-query';
import { globalToast } from '@/components/ui/Toast';

let lastErrorAt = 0;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.warn('[Comly] Query failed:', error);
      // Throttle so a burst of failing queries shows one toast, not five.
      const now = Date.now();
      if (now - lastErrorAt < 4000) return;
      lastErrorAt = now;
      globalToast.current?.error(
        "Couldn't load the latest data. Pull to refresh to try again."
      );
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Centralized query keys so invalidations stay consistent. */
export const queryKeys = {
  feedJobs: ['jobs', 'feed'] as const,
  myJobs: ['jobs', 'mine'] as const,
  job: (id: string) => ['jobs', 'detail', id] as const,
  jobContact: (id: string) => ['jobs', 'contact', id] as const,
  jobApplications: (jobId: string) => ['applications', jobId] as const,
  myApplications: ['applications', 'mine'] as const,
  recommendedHelpers: ['helpers', 'recommended'] as const,
  profile: (id: string) => ['profile', id] as const,
  userReviews: (id: string) => ['reviews', id] as const,
  notifications: ['notifications'] as const,
  myReports: ['reports', 'mine'] as const,
  allReports: ['reports', 'all'] as const,
  mySupportTickets: ['support', 'mine'] as const,
  allSupportTickets: ['support', 'all'] as const,
  blockedUsers: ['blocked'] as const,
  impactStats: ['impact'] as const,
};
