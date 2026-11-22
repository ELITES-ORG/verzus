import type { AuthGateway, AuthSession } from '../ports/accounts';

/**
 * Password sign-in through Supabase Auth's REST endpoint, with the project's publishable key (the
 * same public key the apps ship with). A wrong password or an unconfirmed email comes back as a
 * 400; that is "no session", not a server fault.
 */
export function createSupabaseAuthGateway(supabaseUrl: string, publishableKey: string): AuthGateway {
  return {
    async signInWithPassword(email, password) {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 400) return null;
      if (!res.ok) throw new Error(`Supabase Auth sign-in failed: ${res.status}`);
      const s = (await res.json()) as AuthSession;
      return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, token_type: s.token_type };
    },
  };
}
