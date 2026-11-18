import { applyInactivity } from '@verzus/rating';
import { createSql } from '../adapters/postgres/unit-of-work';
import { loadEnv } from '../env';

/**
 * Daily Render cron job. Players who haven't played ranked in a sport for over
 * a week get one day's worth of sigma growth per run, so their rating
 * readjusts quickly when they come back. Mu (skill) is never lowered.
 *
 * Not written to rating_history: one row per inactive player per day would
 * swamp it. The match rows on either side show the net effect.
 */
const GRACE_DAYS = 7;

const env = loadEnv();
const sql = createSql(env.DATABASE_URL);

try {
  let updated = 0;
  let inactive = 0;
  await sql.begin(async (tx) => {
    // Read and lock inside the transaction (same user-id order as match rating),
    // so a match rated meanwhile can't have its new sigma overwritten.
    const rows = await tx<{ user_id: string; sport: string; mu: number; sigma: number }[]>`
      select user_id, sport, mu, sigma from public.ratings
      where mode = 'ranked' and last_played_at < now() - make_interval(days => ${GRACE_DAYS})
      order by user_id
      for update`;
    inactive = rows.length;
    for (const r of rows) {
      const next = applyInactivity({ mu: r.mu, sigma: r.sigma }, 1);
      if (next.sigma === r.sigma) continue;
      await tx`
        update public.ratings set sigma = ${next.sigma}, updated_at = now()
        where user_id = ${r.user_id} and sport = ${r.sport} and mode = 'ranked'`;
      updated++;
    }
  });
  console.log(`inactivity-decay: ${updated} of ${inactive} inactive ratings updated`);
} finally {
  await sql.end({ timeout: 5 });
}
