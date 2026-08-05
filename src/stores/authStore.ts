/**
 * Auth & session store (Zustand).
 *
 * Holds the signed-in user, onboarding progress, and the active role (customer
 * vs helper) — users can hold both roles and switch between them.
 *
 * The store is a *reflection* of Supabase's session, never the source of truth.
 * `bootstrap()` restores an existing session on launch and subscribes to auth
 * changes, so a session that expires or is revoked server-side signs the user
 * out here too. Screens await `signIn`/`signUp`; neither resolves successfully
 * until the server has actually authenticated the user and their profile has
 * loaded.
 */

import { create } from 'zustand';
import { Role, UserProfile } from '@/types/domain';
import { USE_MOCKS } from '@/config/env';
import { backend } from '@/services';
import {
  getCurrentUserId,
  onAuthChange,
  signInWithEmail,
  signOutEverywhere,
  signUpWithEmail,
  SignUpParams,
} from '@/services/auth';

type AuthOutcome =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  /** True until the initial session check finishes; gates the first render. */
  isBootstrapping: boolean;
  activeRole: Role;

  bootstrap: () => Promise<void>;
  completeOnboarding: () => void;
  signIn: (email: string, password: string) => Promise<AuthOutcome>;
  signUp: (params: SignUpParams) => Promise<AuthOutcome>;
  /** Adopts a session established out-of-band (OAuth) and loads the profile. */
  adoptSession: () => Promise<AuthOutcome>;
  signOut: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  setActiveRole: (role: Role) => void;
  toggleRole: () => void;
}

/** 'admin' is a capability, not a home experience. */
const startingRole = (roles: Role[]): Role =>
  roles.find((r) => r !== 'admin') ?? 'customer';

/**
 * Demo profile, used only when EXPO_PUBLIC_USE_MOCKS is explicitly enabled.
 * Imported lazily so the seeded fixtures never reach a production bundle's
 * startup path.
 */
async function mockProfile(): Promise<UserProfile> {
  const { currentUser } = await import('@/lib/mockData');
  return currentUser;
}

/**
 * Loads the authenticated user's profile row.
 *
 * Signup inserts the profile via a database trigger in the same transaction as
 * the auth user, but replication to the API can lag by a few hundred ms on a
 * cold project — so a single miss is retried rather than reported as failure.
 */
async function loadProfile(userId: string): Promise<UserProfile | null> {
  const profile = await backend.getProfile(userId);
  if (profile) return profile;
  await new Promise((r) => setTimeout(r, 600));
  return backend.getProfile(userId);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hasOnboarded: false,
  isBootstrapping: true,
  activeRole: 'customer',

  bootstrap: async () => {
    if (USE_MOCKS) {
      set({ isBootstrapping: false });
      return;
    }

    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const profile = await loadProfile(userId);
        if (profile) {
          set({
            user: profile,
            isAuthenticated: true,
            hasOnboarded: true,
            activeRole: startingRole(profile.roles),
          });
        }
      }
    } catch (err) {
      // A failed restore must not wedge the app on a blank screen; fall through
      // to the signed-out experience.
      console.warn('[Comly] Could not restore session:', err);
    } finally {
      set({ isBootstrapping: false });
    }

    // Keep local state in step with the server for the life of the app.
    onAuthChange(async (userId) => {
      if (!userId) {
        set({ user: null, isAuthenticated: false, activeRole: 'customer' });
        return;
      }
      if (get().isAuthenticated) return; // already in sync
      const profile = await loadProfile(userId);
      if (profile) {
        set({
          user: profile,
          isAuthenticated: true,
          hasOnboarded: true,
          activeRole: startingRole(profile.roles),
        });
      }
    });
  },

  completeOnboarding: () => set({ hasOnboarded: true }),

  signIn: async (email, password) => {
    const result = await signInWithEmail(email, password);
    if (!result.ok) return result;
    return get().adoptSession();
  },

  signUp: async (params) => {
    const result = await signUpWithEmail(params);
    if (!result.ok) return result;

    // Email confirmation is on: there is no session yet, so stay signed out
    // and let the screen tell the user to check their inbox.
    if (result.needsEmailConfirmation) {
      return { ok: true, needsEmailConfirmation: true };
    }

    const adopted = await get().adoptSession();
    if (adopted.ok) set({ activeRole: params.role });
    return adopted;
  },

  adoptSession: async () => {
    if (USE_MOCKS) {
      const profile = await mockProfile();
      set({
        user: profile,
        isAuthenticated: true,
        hasOnboarded: true,
        activeRole: startingRole(profile.roles),
      });
      return { ok: true };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { ok: false, message: 'Sign-in did not complete. Please try again.' };
    }

    const profile = await loadProfile(userId);
    if (!profile) {
      // Authenticated but no profile row — the account exists in a broken
      // state. Signing back out is safer than an app running on a null user.
      await signOutEverywhere();
      return {
        ok: false,
        message: 'Your account is missing its profile. Please contact support.',
      };
    }

    set({
      user: profile,
      isAuthenticated: true,
      hasOnboarded: true,
      activeRole: startingRole(profile.roles),
    });
    return { ok: true };
  },

  signOut: async () => {
    try {
      await signOutEverywhere();
    } catch (err) {
      // Revoking the server session can fail offline. Clearing local state
      // anyway is the right call: the user asked to be signed out, and the
      // stored refresh token is dropped with it. Throwing here would leave
      // them stuck inside the app with no way out.
      console.warn('[Comly] Sign-out request failed; clearing locally:', err);
    }
    set({ user: null, isAuthenticated: false, activeRole: 'customer' });
  },

  setUser: (user) => set({ user }),

  setActiveRole: (role) => set({ activeRole: role }),

  toggleRole: () => {
    const { activeRole, user } = get();
    if (!user || user.roles.length < 2) return;
    set({ activeRole: activeRole === 'customer' ? 'helper' : 'customer' });
  },
}));
