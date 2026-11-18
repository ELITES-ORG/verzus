import { hc } from 'hono/client';
import type { AppType } from './app';

export type { AppType } from './app';

/**
 * Typed API client for the player app and venue dashboard. Route paths, inputs
 * and responses are checked against the API's code at compile time.
 *
 *   const api = createApiClient(API_URL, async () => (await supabase.auth.getSession()).data.session?.access_token);
 *   const res = await api.bookings.$post({ json: { courtId, startsAt, endsAt } });
 */
export function createApiClient(baseUrl: string, getAccessToken: () => Promise<string | undefined | null>) {
  return hc<AppType>(baseUrl, {
    headers: async (): Promise<Record<string, string>> => {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
}
