/** Accounts: what username sign-in needs, as interfaces (adapters/ implements them). */

/** Finds the email behind a username. Server-side only: emails never go back to clients. */
export interface AccountDirectory {
  emailForUsername(username: string): Promise<string | null>;
}

/** A signed-in session, in the shape Supabase's clients take (supabase.auth.setSession). */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/** Password sign-in with the auth provider (Supabase Auth). */
export interface AuthGateway {
  /** The session, or null when the email and password don't match (or the email isn't confirmed). */
  signInWithPassword(email: string, password: string): Promise<AuthSession | null>;
}
