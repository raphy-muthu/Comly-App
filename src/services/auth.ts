/**
 * Authentication — real Supabase Auth, with an explicit demo-mode bypass.
 *
 * Every function returns a discriminated `AuthResult` rather than throwing, so
 * screens render a specific, human message instead of a generic failure. Raw
 * Supabase errors leak implementation detail ("AuthApiError: Invalid login
 * credentials"), so they are mapped in `friendlyError` below.
 *
 * Session persistence is handled by the Supabase client itself (AsyncStorage +
 * auto-refresh, see supabaseClient.ts) — nothing here stores tokens by hand.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { USE_MOCKS, hasSupabaseConfig } from '@/config/env';
import { Role } from '@/types/domain';
import { getSupabase } from './supabaseClient';

export type OAuthProvider = 'google' | 'apple';

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  neighborhood: string;
  role: Role;
  /**
   * ISO date (YYYY-MM-DD). The single source of truth for the teen-safety gate:
   * migration 0013 derives both `age_bracket` and `age_group` from it and
   * refuses the signup outright below the minimum age, so the app no longer
   * sends a self-reported age group at all. Server-owned once set.
   */
  dateOfBirth: string;
  /**
   * Versions of the Terms of Service and Privacy Policy the user ticked the
   * consent box for. Sent as metadata rather than as a boolean: knowing that
   * someone agreed is close to useless without knowing WHAT they agreed to.
   * The acceptance timestamps are set server-side by handle_new_user, never
   * from the device clock.
   */
  termsVersion: string;
  privacyVersion: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Supabase surfaces terse, sometimes cryptic errors. Translate the common ones.
 * Exported for tests: these strings are the entire failure surface a locked-out
 * user sees, so a regression here is silent but expensive.
 */
export function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'That email and password combination doesn’t match an account.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'An account with that email already exists. Try logging in instead.';
  }
  if (m.includes('password should be at least')) {
    return 'Please choose a password of at least 6 characters.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'That doesn’t look like a valid email address.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('token has expired') || m.includes('otp_expired')) {
    return 'That code has expired. Request a new one.';
  }
  if (m.includes('invalid otp') || m.includes('token is invalid')) {
    return 'That code isn’t right. Check it and try again.';
  }
  if (m.includes('phone provider') || m.includes('unsupported phone provider')) {
    return 'Phone sign-in isn’t enabled yet. Please use email instead.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  // Migration 0013's signup gate raises when the date of birth is missing,
  // unparseable, or below the minimum age. GoTrue usually collapses a trigger
  // exception into this one opaque string, which would otherwise leave the
  // user staring at "Database error" with nothing to act on.
  if (m.includes('database error saving new user')) {
    return 'We couldn’t create your account. Please check your date of birth and try again.';
  }
  return raw;
}

/**
 * Guard for the misconfiguration that would otherwise fail deep in the client
 * with an opaque error: real mode requested, credentials absent.
 */
function configError(): { ok: false; message: string } {
  return {
    ok: false,
    message:
      'The app isn’t connected to a server yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  };
}

// ── Email + password ─────────────────────────────────────────────────────────

export async function signUpWithEmail(params: SignUpParams): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(600);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const { data, error } = await getSupabase().auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      // Without this the confirmation email links to Supabase's default Site
      // URL (http://localhost:3000 until configured otherwise) — dead end on
      // a phone. This routes it back into the app's own scheme instead. Also
      // requires "comly://auth-callback" to be allow-listed under Supabase
      // dashboard → Auth → URL Configuration → Redirect URLs, or Supabase
      // rejects the redirect and falls back to the default anyway.
      emailRedirectTo: Linking.createURL('auth-callback'),
      // Consumed by the handle_new_user trigger to provision profiles,
      // profiles_private and verification_status in one transaction.
      data: {
        name: params.name.trim(),
        neighborhood: params.neighborhood.trim(),
        roles: [params.role],
        // age_group is deliberately not sent: 0013 derives it from this date,
        // so a client-supplied value would be ignored anyway.
        date_of_birth: params.dateOfBirth,
        terms_version: params.termsVersion,
        privacy_version: params.privacyVersion,
      },
    },
  });

  if (error) return { ok: false, message: friendlyError(error.message) };

  // With email confirmation enabled, Supabase returns a user but no session.
  // The caller must not treat that as being signed in.
  return { ok: true, needsEmailConfirmation: !data.session };
}

/**
 * Records legal consent for the signed-in user.
 *
 * Needed because OAuth sign-up never passes through signUpWithEmail: Google
 * and Apple create the account themselves, so there is no metadata to carry
 * the consent versions. The RPC is SECURITY DEFINER (migration 0015) because
 * the consent columns are pinned against self-service edits like every other
 * server-owned field, and it only ever fills columns that are still null — so
 * calling it twice cannot rewrite an earlier acceptance.
 *
 * Deliberately does not throw. A failed consent write must not strand someone
 * mid-sign-in with a live account they cannot reach; the call is idempotent
 * and safe to retry on next launch.
 */
export async function recordLegalConsent(
  termsVersion: string,
  privacyVersion: string
): Promise<void> {
  if (USE_MOCKS || !hasSupabaseConfig) return;
  const { error } = await getSupabase().rpc('record_legal_consent', {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
  });
  if (error) {
    console.warn('[Comly] Could not record legal consent:', error.message);
  }
}

/**
 * Record acceptance of NEW document versions by an existing account.
 *
 * Separate from recordLegalConsent because that one deliberately cannot move a
 * version forward — it exists to fill in first consent for OAuth signups
 * without letting a retry rewrite an earlier acceptance. This one advances the
 * stored version and appends to the consent history (migration 0023).
 *
 * Unlike recordLegalConsent, a failure here is surfaced rather than logged: the
 * caller is a blocking prompt, and silently "succeeding" would let someone
 * through without their agreement ever being recorded.
 */
export async function acceptLegalVersions(
  termsVersion: string,
  privacyVersion: string
): Promise<AuthResult> {
  if (USE_MOCKS) {
    // Record it on the demo profile rather than returning a bare ok. The gate
    // re-reads the profile to decide whether to stop rendering, so a no-op
    // here leaves it mounted over a save it was told had succeeded.
    // Imported lazily so the fixtures stay out of a production bundle.
    const { currentUser } = await import('@/lib/mockData');
    const now = new Date().toISOString();
    currentUser.legalConsent = {
      termsVersion,
      termsAcceptedAt: now,
      privacyVersion,
      privacyAcceptedAt: now,
    };
    return { ok: true };
  }
  if (!hasSupabaseConfig) return { ok: true };

  const { error } = await getSupabase().rpc('accept_legal_versions', {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
  });
  if (error) {
    return { ok: false, message: friendlyError(error.message) };
  }
  return { ok: true };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(600);
    // Mock mode accepts any credentials, but a few reserved addresses select a
    // specific seeded persona — the E2E suite needs a teen helper to exercise
    // the eligibility refusal, which no adult account can trigger.
    const { signInAsMockPersona } = await import('./mockBackend');
    signInAsMockPersona(email);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(400);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('/reset-password'),
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

export async function signOutEverywhere(): Promise<void> {
  if (USE_MOCKS || !hasSupabaseConfig) return;
  // Clearing local state without this leaves a live server session behind —
  // the user looks signed out while their tokens keep working.
  await getSupabase().auth.signOut();
}

export interface DeleteAccountResult {
  ok: boolean;
  /**
   * Present when there is something to say either way — a failure reason, or
   * the demo-mode notice that nothing was actually deleted. AuthResult cannot
   * carry a message on success, and here a successful no-op needs one.
   */
  message?: string;
}

/**
 * Permanently delete the signed-in user's account. Irreversible.
 *
 * The account id is never sent — the edge function reads it from the verified
 * JWT, so this cannot be aimed at anyone else's account.
 *
 * Reviews the user wrote and no-show reports they filed are kept but detached
 * from them, because those records belong to the other party's history
 * (migration 0022). Everything that is only theirs goes.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  if (USE_MOCKS || !hasSupabaseConfig) {
    await delay(600);
    // Demo mode has no server to delete anything from. Say so rather than
    // reporting a deletion that did not happen.
    return { ok: true, message: 'Demo mode: no account was actually deleted.' };
  }

  try {
    const { data, error } = await getSupabase().functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      const detail = await readFunctionError(error);
      return { ok: false, message: detail ?? 'Could not delete your account.' };
    }
    if (!(data as { ok?: boolean })?.ok) {
      return { ok: false, message: 'Could not delete your account.' };
    }

    // The server row is gone; clear the local session so the app cannot keep
    // using tokens for an account that no longer exists.
    await getSupabase().auth.signOut();
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }
}

/**
 * supabase-js wraps a non-2xx function response in a FunctionsHttpError whose
 * body has to be read off the attached Response to get the real message.
 */
async function readFunctionError(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response })?.context;
  if (!res || typeof res.json !== 'function') return null;
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

// ── Phone (SMS one-time code) ────────────────────────────────────────────────
//
// Requires an SMS provider (Twilio, MessageBird, …) configured under
// Authentication → Providers → Phone in the Supabase dashboard. Until then
// Supabase rejects the request and the user sees the mapped message rather
// than a code box that accepts anything.

export async function sendPhoneCode(phone: string): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(500);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const { error } = await getSupabase().auth.signInWithOtp({
    phone: phone.replace(/[^\d+]/g, ''),
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

export async function verifyPhoneCode(
  phone: string,
  code: string
): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(500);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const { error } = await getSupabase().auth.verifyOtp({
    phone: phone.replace(/[^\d+]/g, ''),
    token: code,
    type: 'sms',
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

// ── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Native OAuth: Supabase mints a provider URL, we open it in a system auth
 * session, and the provider redirects back to the app scheme with a code we
 * exchange for a session.
 *
 * Requires the provider to be enabled in the Supabase dashboard with
 * `comly://auth-callback` registered as a redirect URL — until then the
 * provider returns a redirect_uri error, which surfaces as a readable message.
 */
export async function signInWithProvider(
  provider: OAuthProvider
): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(700);
    return { ok: true };
  }
  if (!hasSupabaseConfig) return configError();

  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  if (!data?.url) {
    return { ok: false, message: 'Could not start sign-in. Please try again.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, message: 'Sign-in was cancelled.' };
  }
  if (result.type !== 'success') {
    return { ok: false, message: 'Sign-in did not complete. Please try again.' };
  }

  // The provider may return either a PKCE `code` or a token fragment.
  const url = result.url;
  const code = Linking.parse(url).queryParams?.code;
  if (typeof code === 'string') {
    const { error: exchangeError } =
      await getSupabase().auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return { ok: false, message: friendlyError(exchangeError.message) };
    }
    return { ok: true };
  }

  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await getSupabase().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      return { ok: false, message: friendlyError(sessionError.message) };
    }
    return { ok: true };
  }

  return { ok: false, message: 'Sign-in did not return a session.' };
}

// ── Session ──────────────────────────────────────────────────────────────────

/** The signed-in user's id, or null. Used to restore a session on launch. */
export async function getCurrentUserId(): Promise<string | null> {
  if (USE_MOCKS || !hasSupabaseConfig) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Fires on sign-in, sign-out, and token refresh — including refresh failures,
 * which is how an expired/revoked session gets caught while the app is open.
 */
export function onAuthChange(
  handler: (userId: string | null) => void
): () => void {
  if (USE_MOCKS || !hasSupabaseConfig) return () => {};
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    handler(session?.user.id ?? null);
  });
  return () => data.subscription.unsubscribe();
}
