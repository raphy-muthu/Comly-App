/**
 * Auth service — social sign-in behind the mock toggle.
 *
 * Mock mode: resolves after a beat so loading states render, then the caller
 * signs in the demo user.
 *
 * Real mode: Supabase OAuth in React Native requires an app-scheme redirect
 * (comly://) plus provider credentials — full setup steps live in
 * DEPLOYMENT.md §OAuth. Until configured, we fail with a clear, actionable
 * message instead of a silent broken button.
 */

import { USE_MOCKS, hasSupabaseConfig } from '@/config/env';

export type OAuthProvider = 'google' | 'apple';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function signInWithProvider(
  provider: OAuthProvider
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCKS) {
    await delay(700); // let the button's loading state render
    return { ok: true };
  }

  if (!hasSupabaseConfig) {
    return {
      ok: false,
      message:
        'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY, then follow DEPLOYMENT.md → OAuth.',
    };
  }

  // TODO(production): implement the native OAuth flow —
  //   1. expo-web-browser + supabase.auth.signInWithOAuth({ provider,
  //      options: { redirectTo: 'comly://auth-callback', skipBrowserRedirect: true } })
  //   2. open data.url in a WebBrowser auth session
  //   3. exchange the returned code via supabase.auth.exchangeCodeForSession
  // Documented step-by-step in DEPLOYMENT.md §OAuth.
  return {
    ok: false,
    message: `${provider === 'google' ? 'Google' : 'Apple'} sign-in needs OAuth credentials — see DEPLOYMENT.md → OAuth setup.`,
  };
}
