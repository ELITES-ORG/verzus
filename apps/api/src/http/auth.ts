import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { AppError } from '../domain/errors';

export type AuthVariables = { userId: string };

export interface AuthConfig {
  supabaseUrl: string;
  /** Legacy HS256 secret. Leave unset: current Supabase (local and hosted) signs with ES256 keys published as JWKS. */
  jwtSecret?: string;
}

/**
 * Verifies the Supabase access token from `Authorization: Bearer …` and puts
 * the user id on the context. Apps send the same token they use with Supabase.
 */
export function requireUser(config: AuthConfig) {
  const issuer = `${config.supabaseUrl}/auth/v1`;
  const key: Uint8Array | JWTVerifyGetKey = config.jwtSecret
    ? new TextEncoder().encode(config.jwtSecret)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('unauthorized', 'Sign in first');

    try {
      const { payload } = await jwtVerify(token, key as Parameters<typeof jwtVerify>[1], {
        issuer,
        audience: 'authenticated',
      });
      if (!payload.sub) throw new Error('no subject');
      c.set('userId', payload.sub);
    } catch {
      throw new AppError('unauthorized', 'Your session has expired. Sign in again.');
    }
    await next();
  });
}
