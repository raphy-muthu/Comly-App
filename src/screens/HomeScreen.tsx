/**
 * Home tab — role-aware. Renders the customer or helper dashboard based on the
 * active role, so switching roles instantly changes the home experience.
 */

import { useAuthStore } from '@/stores/authStore';
import { CustomerDashboard } from '@/screens/customer/CustomerDashboard';
import { HelperDashboard } from '@/screens/helper/HelperDashboard';

export function HomeScreen() {
  const activeRole = useAuthStore((s) => s.activeRole);
  return activeRole === 'helper' ? <HelperDashboard /> : <CustomerDashboard />;
}
