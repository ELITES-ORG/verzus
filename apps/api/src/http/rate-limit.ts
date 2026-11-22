import type { MiddlewareHandler } from 'hono';
import { AppError } from '../domain/errors';

/**
 * A small in-memory limit on attempts per key within a window (one API instance; enough until
 * there are several). Username sign-in uses it: every attempt reaches Supabase from the API's one
 * address, so Supabase can't tell guessers apart and this has to.
 */
export function rateLimit(opts: {
  max: number;
  windowMs: number;
  key: (c: Parameters<MiddlewareHandler>[0]) => string | Promise<string>;
  now?: () => number;
}): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const now = opts.now ?? Date.now;
  return async (c, next) => {
    const t = now();
    // Forget finished windows now and then, so the map doesn't grow without end.
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const key = await opts.key(c);
    const h = hits.get(key);
    if (!h || h.resetAt <= t) hits.set(key, { count: 1, resetAt: t + opts.windowMs });
    else if (++h.count > opts.max) throw new AppError('too_many_requests', 'Too many tries. Wait a few minutes.');
    await next();
  };
}

/** The caller's address. Render puts the client first in X-Forwarded-For. */
export function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
