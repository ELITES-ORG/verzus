import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@verzus/db-types';
import { AppState, Platform } from 'react-native';

// Static dot access: Expo inlines EXPO_PUBLIC_ values at build time only in this form.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/player/.env.local');
}

const isWeb = Platform.OS === 'web';

/** Reads, sign-in and Realtime go straight to Supabase; RLS decides access. */
export const supabase = createClient<Database>(url, key, {
  auth: {
    // The browser uses localStorage by default; native apps persist the session in AsyncStorage.
    ...(isWeb ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

// Native apps only refresh tokens while in the foreground.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
