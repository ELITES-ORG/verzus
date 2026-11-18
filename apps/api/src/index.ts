import { serve } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { systemClock } from './adapters/clock';
import { createFakePaymentProvider } from './adapters/payments/fake';
import { createPostgresUnitOfWork, createSql } from './adapters/postgres/unit-of-work';
import { createApp } from './app';
import { loadEnv } from './env';

// Composition root: the only place that picks concrete adapters.
const env = loadEnv();

// The fake provider confirms payments from unsigned webhooks. Until a real
// provider is wired in, the API refuses to start in production.
if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'fake') {
  throw new Error('PAYMENT_PROVIDER=fake is not allowed in production. Choose and wire in a real provider first.');
}

if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });

const sql = createSql(env.DATABASE_URL);

const app = createApp({
  uow: createPostgresUnitOfWork(sql),
  payments: createFakePaymentProvider(),
  clock: systemClock,
  auth: { supabaseUrl: env.SUPABASE_URL, jwtSecret: env.SUPABASE_JWT_SECRET },
  corsOrigins: env.CORS_ORIGINS,
  onError: (err) => Sentry.captureException(err),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`verzus API listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void sql.end({ timeout: 5 }).then(() => process.exit(0));
  });
}
