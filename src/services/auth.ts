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
import { AgeGroup, Role } from '@/types/domain';
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
   * Drives the teen-safety gate. Server-owned after signup (migration 0005
   * pins `age_group`), so this is the one moment it can be set from the client
   * — which is exactly why it is a required field, not an optional one.
   */
  ageGroup: AgeGroup;
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
        age_group: params.ageGroup,
      },
    },
  });

  if (error) return { ok: false, message: friendlyError(error.message) };

  // With email confirmation enabled, Supabase returns a user but no session.
  // The caller must not treat that as being signed in.
  return { ok: true, needsEmailConfirmation: !data.session };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (USE_MOCKS) {
    await delay(600);
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
