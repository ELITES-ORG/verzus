import type { UsernameSignInInput } from '@verzus/schemas';
import { AppError } from '../domain/errors';
import type { AccountDirectory, AuthGateway, AuthSession } from '../ports/accounts';

export interface SignInDeps {
  accounts: AccountDirectory;
  auth: AuthGateway;
}

/**
 * Signs a player in with their username and password. Supabase signs in by email only, so the
 * email is looked up here, on the server, and never returned. An unknown username and a wrong
 * password get the same answer, so the endpoint can't be used to find out which usernames exist.
 */
export async function signInWithUsername(deps: SignInDeps, input: UsernameSignInInput): Promise<AuthSession> {
  const email = await deps.accounts.emailForUsername(input.username);
  const session = email ? await deps.auth.signInWithPassword(email, input.password) : null;
  if (!session) throw new AppError('invalid_credentials', 'Wrong username or password');
  return session;
}
