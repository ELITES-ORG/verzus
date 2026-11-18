import { zValidator } from '@hono/zod-validator';
import { ConfirmResultInput, CreateBookingInput, JoinMatchInput, OpenMatchInput } from '@verzus/schemas';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError, ERROR_STATUS } from './domain/errors';
import { type AuthConfig, type AuthVariables, requireUser } from './http/auth';
import type { Clock } from './ports/clock';
import type { PaymentProvider } from './ports/payment-provider';
import type { UnitOfWork } from './ports/repositories';
import { confirmResult } from './use-cases/confirm-result';
import { createBooking } from './use-cases/create-booking';
import { handlePaymentEvent } from './use-cases/handle-payment-event';

export interface AppDeps {
  uow: UnitOfWork;
  payments: PaymentProvider;
  clock: Clock;
  auth: AuthConfig;
  corsOrigins: string[];
  onError?: (err: unknown) => void;
}

/**
 * HTTP layer only: validate input, call a use case, shape the response.
 * Business rules live in use-cases/ and the @verzus/rating and
 * @verzus/matchmaking packages.
 */
export function createApp(deps: AppDeps) {
  const auth = requireUser(deps.auth);

  const app = new Hono<{ Variables: AuthVariables }>()
    .use('*', cors({ origin: deps.corsOrigins, allowHeaders: ['Authorization', 'Content-Type'] }))

    .get('/health', (c) => c.json({ ok: true }))

    .get('/me', auth, (c) => c.json({ userId: c.get('userId') }))

    .post('/bookings', auth, zValidator('json', CreateBookingInput), async (c) => {
      const result = await createBooking(deps, c.get('userId'), c.req.valid('json'));
      return c.json(result, 201);
    })

    .post('/matches', auth, zValidator('json', OpenMatchInput), () => {
      throw new AppError('not_implemented', 'Opening a match is the next flow to build');
    })

    .post('/matches/:id/join', auth, zValidator('json', JoinMatchInput), () => {
      throw new AppError('not_implemented', 'Join-and-pay is not built yet');
    })

    .post('/matches/:id/result', auth, zValidator('json', ConfirmResultInput), async (c) => {
      const { winningTeam } = c.req.valid('json');
      const result = await confirmResult(deps, c.get('userId'), c.req.param('id'), winningTeam);
      return c.json(result);
    })

    // Payment webhooks: no user token; the provider adapter verifies the signature.
    .post('/webhooks/:provider', async (c) => {
      if (c.req.param('provider') !== deps.payments.name) return c.json({ error: 'unknown provider' }, 404);
      const rawBody = await c.req.text();
      const event = await deps.payments.parseWebhook({ headers: c.req.raw.headers, rawBody }).catch(() => {
        // Bad signature or malformed body: reject without treating it as a server fault.
        throw new AppError('bad_request', 'Invalid webhook');
      });
      if (!event) return c.json({ ignored: true });
      const outcome = await handlePaymentEvent({ uow: deps.uow, providerName: deps.payments.name }, event);
      return c.json({ outcome });
    });

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.code, message: err.message }, ERROR_STATUS[err.code]);
    }
    deps.onError?.(err);
    console.error(err);
    return c.json({ error: 'internal', message: 'Something went wrong' }, 500);
  });

  return app;
}

/** The route types, for the typed `hc` client the apps use. */
export type AppType = ReturnType<typeof createApp>;
