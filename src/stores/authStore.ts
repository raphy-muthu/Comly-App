/**
 * Auth & session store (Zustand).
 *
 * Holds the signed-in user, onboarding progress, and the active role (customer
 * vs helper) — users can hold both roles and switch between them. In mock mode
 * sign-in resolves instantly to the seeded demo user.
 */

import { create } from 'zustand';
import { Role, UserProfile } from '@/types/domain';
import { currentUser } from '@/lib/mockData';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  activeRole: Role;

  completeOnboarding: () => void;
  /** Mock sign-in — replaced by Supabase auth when mocks are off. */
  signIn: (user?: UserProfile) => void;
  signOut: () => void;
  setUser: (user: UserProfile) => void;
  setActiveRole: (role: Role) => void;
  toggleRole: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hasOnboarded: false,
  activeRole: 'customer',

  completeOnboarding: () => set({ hasOnboarded: true }),

  signIn: (user = currentUser) =>
    set({
      user,
      isAuthenticated: true,
      // 'admin' is a capability, not a home experience — start in the first
      // customer/helper role.
      activeRole: user.roles.find((r) => r !== 'admin') ?? 'customer',
    }),

  signOut: () =>
    set({ user: null, isAuthenticated: false, activeRole: 'customer' }),

  setUser: (user) => set({ user }),

  setActiveRole: (role) => set({ activeRole: role }),

  toggleRole: () => {
    const { activeRole, user } = get();
    if (!user || user.roles.length < 2) return;
    set({ activeRole: activeRole === 'customer' ? 'helper' : 'customer' });
  },
}));
