import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_JWT_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  PAYMENT_PROVIDER: z.enum(['fake']).default('fake'),
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof Env>;

/** Fails fast at startup with a readable list of missing or invalid settings. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
