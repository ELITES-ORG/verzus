import { createApiClient } from '@verzus/api/client';
import { supabase } from './supabase';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

/**
 * Typed client for the verzus API: anything touching money, ratings or match
 * state goes here, never straight to Supabase.
 *   const res = await api.bookings.$post({ json: { courtId, startsAt, endsAt } });
 */
export const api = createApiClient(baseUrl, async () => (await supabase.auth.getSession()).data.session?.access_token);
