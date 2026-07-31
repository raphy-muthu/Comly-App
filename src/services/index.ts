/**
 * Backend selector.
 *
 * Resolves the active `DataBackend` based on configuration. Today only the mock
 * backend exists; Phase 8 adds `supabaseBackend` and this switch flips to it
 * when real credentials are present.
 */

import { USE_MOCKS, hasSupabaseConfig } from '@/config/env';
import { mockBackend } from './mockBackend';
import { supabaseBackend } from './supabaseBackend';
import type { DataBackend } from './types';

function resolveBackend(): DataBackend {
  if (!USE_MOCKS && hasSupabaseConfig) {
    return supabaseBackend;
  }
  if (!USE_MOCKS && !hasSupabaseConfig) {
    // Real mode requested but not configured — fail safe to mock data.
    console.warn(
      '[Comly] Supabase not configured; falling back to mock backend. ' +
        'Set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY and EXPO_PUBLIC_USE_MOCKS=false.'
    );
  }
  return mockBackend;
}

export const backend: DataBackend = resolveBackend();

export * from './types';
