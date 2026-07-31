/**
 * Typed access to environment configuration.
 *
 * `EXPO_PUBLIC_*` vars are inlined at build time by Expo. We also read
 * `expo.extra.useMocks` from app.json as a fallback default so the app still
 * runs in mock mode even if no .env is present.
 */

import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { useMocks?: boolean };

const truthy = (v: string | undefined): boolean =>
  v === 'true' || v === '1' || v === 'yes';

/**
 * When true, all services resolve to in-memory mock implementations seeded with
 * demo data. Defaults to true unless explicitly disabled, so the app is always
 * runnable out of the box.
 */
export const USE_MOCKS: boolean = process.env.EXPO_PUBLIC_USE_MOCKS
  ? truthy(process.env.EXPO_PUBLIC_USE_MOCKS)
  : extra.useMocks ?? true;

export const env = {
  useMocks: USE_MOCKS,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
} as const;

/** True only when real Supabase credentials are present and mocks are off. */
export const hasSupabaseConfig: boolean =
  !USE_MOCKS && !!env.supabaseUrl && !!env.supabaseAnonKey;
