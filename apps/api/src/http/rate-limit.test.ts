import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { AppError, ERROR_STATUS } from '../domain/errors';
import { clientIp, rateLimit } from './rate-limit';

function app(now: () => number) {
  const a = new Hono().post('/x', rateLimit({ max: 2, windowMs: 1000, key: clientIp, now }), (c) => c.text('ok'));
  a.onError((err, c) => (err instanceof AppError ? c.text(err.code, ERROR_STATUS[err.code]) : c.text('boom', 500)));
  return a;
}
const hit = (a: Hono, ip: string) => a.request('/x', { method: 'POST', headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

describe('rateLimit', () => {
  it('allows the set number of tries per address, then refuses until the window ends', async () => {
    let t = 0;
    const a = app(() => t);
    expect((await hit(a, '1.1.1.1')).status).toBe(200);
    expect((await hit(a, '1.1.1.1')).status).toBe(200);
    expect((await hit(a, '1.1.1.1')).status).toBe(429);
    expect((await hit(a, '2.2.2.2')).status).toBe(200);
    t = 1000;
    expect((await hit(a, '1.1.1.1')).status).toBe(200);
  });
});
