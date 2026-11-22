import { describe, expect, it } from 'vitest';
import { AppError } from '../domain/errors';
import type { AuthSession } from '../ports/accounts';
import { signInWithUsername } from './sign-in-with-username';

const SESSION: AuthSession = { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'bearer' };

function deps(users: Record<string, { email: string; password: string }>) {
  const asked: string[] = [];
  return {
    asked,
    deps: {
      accounts: { emailForUsername: async (u: string) => users[u]?.email ?? null },
      auth: {
        signInWithPassword: async (email: string, password: string) => {
          asked.push(email);
          return Object.values(users).some((x) => x.email === email && x.password === password) ? SESSION : null;
        },
      },
    },
  };
}

describe('signInWithUsername', () => {
  const users = { maria: { email: 'maria@example.com', password: 'correct horse' } };

  it('signs in with the email behind the username', async () => {
    const { deps: d, asked } = deps(users);
    await expect(signInWithUsername(d, { username: 'maria', password: 'correct horse' })).resolves.toEqual(SESSION);
    expect(asked).toEqual(['maria@example.com']);
  });

  it('gives the same answer for a wrong password and an unknown username', async () => {
    const { deps: d, asked } = deps(users);
    const wrong = await signInWithUsername(d, { username: 'maria', password: 'nope' }).catch((e) => e);
    const unknown = await signInWithUsername(d, { username: 'nobody', password: 'nope' }).catch((e) => e);
    for (const e of [wrong, unknown]) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('invalid_credentials');
      expect(e.message).toBe('Wrong username or password');
    }
    // An unknown username never reaches the auth provider.
    expect(asked).toEqual(['maria@example.com']);
  });
});
