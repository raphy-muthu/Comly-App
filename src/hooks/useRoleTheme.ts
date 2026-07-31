/**
 * Returns the accent theme for the currently active role.
 */

import { getRoleTheme, RoleTheme } from '@/theme';
import { useAuthStore } from '@/stores/authStore';

export function useRoleTheme(): RoleTheme {
  const activeRole = useAuthStore((s) => s.activeRole);
  return getRoleTheme(activeRole);
}
