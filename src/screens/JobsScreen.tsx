/**
 * Jobs tab — role-aware. Customers see the jobs they've posted; helpers see the
 * nearby job feed they can apply to.
 */

import { useAuthStore } from '@/stores/authStore';
import { MyJobsScreen } from '@/screens/customer/MyJobsScreen';
import { JobFeedScreen } from '@/screens/helper/JobFeedScreen';

export function JobsScreen() {
  const activeRole = useAuthStore((s) => s.activeRole);
  return activeRole === 'helper' ? <JobFeedScreen /> : <MyJobsScreen />;
}
