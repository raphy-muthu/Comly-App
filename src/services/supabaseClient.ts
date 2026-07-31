/**
 * Supabase client (typed). Created lazily and only when real credentials are
 * present, so mock-mode builds never construct it. Auth sessions persist via
 * AsyncStorage with automatic token refresh.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from '@/config/env';
import { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!hasSupabaseConfig) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY and EXPO_PUBLIC_USE_MOCKS=false.'
    );
  }
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
