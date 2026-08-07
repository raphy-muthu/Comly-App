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
 * Outcome of a profile fetch. "missing" and "error" must stay distinguishable:
 * a genuinely absent profile row means the account is broken and the user gets
 * signed out, whereas a transient fetch failure must never do that.
 */
type ProfileLoad =
  | { status: 'ok'; profile: UserProfile }
  | { status: 'missing' }
  | { status: 'error'; error: unknown };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads the authenticated user's profile row, tolerating two distinct
 * first-moment failures:
 *
 *  • Signup inserts the profile via a database trigger in the same transaction
 *    as the auth user, but replication to the API can lag a few hundred ms on a
 *    cold project — so an empty result is retried before being called missing.
 *
 *  • A token used in the instant after it is minted can be rejected outright
 *    with PostgREST's "JWT issued at future" (PGRST303). Supabase Auth mints
 *    the token and PostgREST validates it; they are separate services, and
 *    sub-second clock drift between them is enough. It clears on its own within
 *    a second, so a throw is retried rather than surfaced.
 *
 * Never throws — callers get a status instead, so no path can produce an
 * unhandled rejection.
 */
async function loadProfile(userId: string): Promise<ProfileLoad> {
  const ATTEMPTS = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
    try {
      const profile = await backend.getProfile(userId);
      if (profile) return { status: 'ok', profile };
      // Empty result — fall through and retry in case the trigger hasn't
      // replicated yet.
      lastError = null;
    } catch (err) {
      lastError = err;
    }
  }

  return lastError ? { status: 'error', error: lastError } : { status: 'missing' };
}

/**
 * Deduplicates concurrent loads for the same user.
 *
 * Sign-in drives two paths at once: the explicit adoptSession() call, and the
 * SIGNED_IN event that Supabase emits into onAuthChange. Both want the profile.
 * Letting them each issue their own request doubles the exposure to the
 * first-moment failures above for no benefit.
 */
let inFlight: { userId: string; promise: Promise<ProfileLoad> } | null = null;

function loadProfileOnce(userId: string): Promise<ProfileLoad> {
  if (inFlight?.userId === userId) return inFlight.promise;
  const promise = loadProfile(userId).finally(() => {
    if (inFlight?.userId === userId) inFlight = null;
  });
  inFlight = { userId, promise };
  return promise;
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
        const result = await loadProfileOnce(userId);
        if (result.status === 'ok') {
          set({
            user: result.profile,
            isAuthenticated: true,
            hasOnboarded: true,
            activeRole: startingRole(result.profile.roles),
          });
        } else if (result.status === 'error') {
          console.warn('[Comly] Could not load profile on restore:', result.error);
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
    //
    // This callback is fire-and-forget — Supabase does not await it and nothing
    // upstream can catch it, so it must swallow its own failures. An escaping
    // rejection here surfaces as a full-screen red error over a working app.
    onAuthChange(async (userId) => {
      try {
        if (!userId) {
          set({ user: null, isAuthenticated: false, activeRole: 'customer' });
          return;
        }
        if (get().isAuthenticated) return; // already in sync

        // Shares the in-flight request with adoptSession() when both fire for
        // the same sign-in.
        const result = await loadProfileOnce(userId);
        // adoptSession() may have finished while this was awaiting; re-check
        // rather than clobbering state it already set.
        if (result.status === 'ok' && !get().isAuthenticated) {
          set({
            user: result.profile,
            isAuthenticated: true,
            hasOnboarded: true,
            activeRole: startingRole(result.profile.roles),
          });
        }
      } catch (err) {
        console.warn('[Comly] Auth state sync failed:', err);
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

    const result = await loadProfileOnce(userId);

    if (result.status === 'error') {
      // The session is valid; we just couldn't read the profile. Keep the user
      // signed in at the server and let them retry — signing them out here
      // would turn a dropped connection into "your account is broken".
      console.warn('[Comly] Could not load profile after sign-in:', result.error);
      return {
        ok: false,
        message: 'Signed in, but your profile could not be loaded. Please try again.',
      };
    }

    if (result.status === 'missing') {
      // Authenticated but no profile row — the account exists in a broken
      // state. Signing back out is safer than an app running on a null user.
      await signOutEverywhere();
      return {
        ok: false,
        message: 'Your account is missing its profile. Please contact support.',
      };
    }

    set({
      user: result.profile,
      isAuthenticated: true,
      hasOnboarded: true,
      activeRole: startingRole(result.profile.roles),
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
