import { createClient } from '@supabase/supabase-js';
import type { Database } from '@verzus/db-types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in apps/venue/.env.local (see .env.example)');
}

/**
 * Reads and simple writes go straight to Supabase; RLS decides what staff can see and change.
 * PKCE: emailed links and Google come back to /auth/callback with ?code=, which supabase-js
 * exchanges for a session on load (detectSessionInUrl).
 */
export const supabase = createClient<Database>(url, key, { auth: { flowType: 'pkce' } });
