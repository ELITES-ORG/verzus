import type { MatchMode, MatchStatus, SelfAssessment, Sport } from '@verzus/schemas';
import postgres, { PostgresError, type Sql, type TransactionSql } from 'postgres';
import { AppError } from '../../domain/errors';
import type { PaymentRecord, Repos, StoredRating, UnitOfWork } from '../../ports/repositories';

/**
 * Direct Postgres connection for trusted writes. supabase-js cannot run a
 * multi-statement transaction; this can, with row locks.
 * prepare: false keeps it compatible with Supabase's transaction pooler.
 */
export function createSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 10, prepare: false });
}

export function createPostgresUnitOfWork(sql: Sql): UnitOfWork {
  return {
    run: (fn) => sql.begin((tx) => fn(repos(tx))) as ReturnType<typeof fn>,
  };
}

const EXCLUSION_VIOLATION = '23P01';
const INSUFFICIENT_PRIVILEGE = '42501';

function repos(tx: TransactionSql): Repos {
  return {
    bookings: {
      async getCourt(courtId) {
        const [row] = await tx<
          { id: string; venue_id: string; hourly_rate_cents: number; currency: string; bookable: boolean }[]
        >`
          select c.id, c.venue_id, c.hourly_rate_cents, c.currency, (c.is_active and v.is_published) as bookable
          from public.courts c join public.venues v on v.id = c.venue_id
          where c.id = ${courtId}`;
        return row
          ? {
              id: row.id,
              venueId: row.venue_id,
              hourlyRateCents: row.hourly_rate_cents,
              currency: row.currency,
              bookable: row.bookable,
            }
          : null;
      },

      async insertHeld(i) {
        try {
          // Savepoint, so a constraint violation doesn't abort the whole transaction.
          const [row] = await tx.savepoint(
            (sp) => sp<{ id: string }[]>`
              insert into public.bookings (court_id, during, status, source, booked_by, price_cents, hold_expires_at, created_by)
              values (${i.courtId}, tstzrange(${i.startsAt}, ${i.endsAt}, '[)'), 'held', 'app', ${i.bookedBy},
                      ${i.priceCents}, ${i.holdExpiresAt}, ${i.bookedBy})
              returning id`,
          );
          return { id: (row as { id: string }).id };
        } catch (e) {
          if (e instanceof PostgresError && e.code === EXCLUSION_VIOLATION) return 'slot_taken';
          // The database refuses players whose account isn't approved yet.
          if (e instanceof PostgresError && e.code === INSUFFICIENT_PRIVILEGE) {
            throw new AppError('forbidden', 'Your account is waiting for approval');
          }
          throw e;
        }
      },

      async confirm(bookingId) {
        const rows = await tx`
          update public.bookings set status = 'confirmed', hold_expires_at = null
          where id = ${bookingId} and status = 'held'
          returning id`;
        return rows.length === 1;
      },
    },

    payments: {
      async create(i) {
        const [row] = await tx<{ id: string }[]>`
          insert into public.payments (provider, user_id, purpose, booking_id, match_id, amount_cents, currency)
          values (${i.provider}, ${i.userId}, ${i.purpose}, ${i.bookingId}, ${i.matchId}, ${i.amountCents}, ${i.currency})
          returning id`;
        return { id: (row as { id: string }).id };
      },

      async setProviderRef(paymentId, providerRef) {
        await tx`update public.payments set provider_ref = ${providerRef} where id = ${paymentId}`;
      },

      async findByProviderRef(provider, providerRef) {
        const [row] = await tx<
          {
            id: string;
            user_id: string;
            purpose: PaymentRecord['purpose'];
            booking_id: string | null;
            match_id: string | null;
            amount_cents: number;
            currency: string;
            status: PaymentRecord['status'];
          }[]
        >`
          select id, user_id, purpose, booking_id, match_id, amount_cents, currency, status
          from public.payments where provider = ${provider} and provider_ref = ${providerRef}
          for update`;
        return row
          ? {
              id: row.id,
              userId: row.user_id,
              purpose: row.purpose,
              bookingId: row.booking_id,
              matchId: row.match_id,
              amountCents: row.amount_cents,
              currency: row.currency,
              status: row.status,
            }
          : null;
      },

      async setStatus(paymentId, status) {
        await tx`update public.payments set status = ${status} where id = ${paymentId}`;
      },

      async recordWebhookEvent(provider, eventId, payload) {
        const rows = await tx`
          insert into public.webhook_events (provider, event_id, payload)
          values (${provider}, ${eventId}, ${tx.json(payload as postgres.JSONValue)})
          on conflict do nothing
          returning event_id`;
        return rows.length === 1;
      },
    },

    ledger: {
      async post({ currency, entries, paymentId, bookingId, matchId }) {
        const txnId = crypto.randomUUID();
        for (const e of entries) {
          await tx`
            insert into public.ledger_entries (txn_id, account, account_id, amount_cents, currency, kind, payment_id, booking_id, match_id)
            values (${txnId}, ${e.account}, ${e.accountId}, ${e.amountCents}, ${currency}, ${e.kind},
                    ${paymentId ?? null}, ${bookingId ?? null}, ${matchId ?? null})`;
        }
      },

      async venueOfBooking(bookingId) {
        const [row] = await tx<{ venue_id: string }[]>`
          select c.venue_id from public.bookings b join public.courts c on c.id = b.court_id where b.id = ${bookingId}`;
        if (!row) throw new Error(`Booking ${bookingId} not found`);
        return row.venue_id;
      },
    },

    matches: {
      async getForResult(matchId) {
        const [m] = await tx<{ id: string; sport: Sport; mode: MatchMode; status: MatchStatus }[]>`
          select id, sport, mode, status from public.matches where id = ${matchId} for update`;
        if (!m) return null;
        const players = await tx<{ user_id: string; team: 1 | 2 }[]>`
          select user_id, team from public.match_participants
          where match_id = ${matchId} and status = 'paid'`;
        const confirmations = await tx<{ user_id: string; winning_team: 1 | 2 }[]>`
          select user_id, winning_team from public.result_confirmations where match_id = ${matchId}`;
        return {
          ...m,
          players: players.map((p) => ({ userId: p.user_id, team: p.team })),
          confirmations: confirmations.map((c) => ({ userId: c.user_id, winningTeam: c.winning_team })),
        };
      },

      async addConfirmation(matchId, userId, winningTeam) {
        await tx`
          insert into public.result_confirmations (match_id, user_id, winning_team)
          values (${matchId}, ${userId}, ${winningTeam})`;
      },

      async setStatus(matchId, status, winningTeam) {
        await tx`
          update public.matches set status = ${status}, winning_team = coalesce(${winningTeam ?? null}, winning_team)
          where id = ${matchId}`;
      },

      async openDispute(matchId, raisedBy, reason) {
        await tx`
          insert into public.disputes (match_id, raised_by, reason) values (${matchId}, ${raisedBy}, ${reason})
          on conflict (match_id) do nothing`;
      },
    },

    ratings: {
      async getForUpdate(userIds, sport, mode) {
        // Sorted ids + FOR UPDATE: two matches finishing at once lock in the
        // same order, so they can't deadlock.
        const sorted = [...userIds].sort();
        const rows = await tx<
          { user_id: string; mu: number; sigma: number; self_assessment: SelfAssessment; games_played: number }[]
        >`
          select user_id, mu, sigma, self_assessment, games_played from public.ratings
          where user_id = any(${sorted}::uuid[]) and sport = ${sport} and mode = ${mode}
          order by user_id
          for update`;
        return new Map<string, StoredRating>(
          rows.map((r) => [
            r.user_id,
            { userId: r.user_id, mu: r.mu, sigma: r.sigma, selfAssessment: r.self_assessment, gamesPlayed: r.games_played },
          ]),
        );
      },

      async saveAfterMatch({ sport, mode, matchId, playedAt, changes }) {
        for (const { before, after } of changes) {
          await tx`
            insert into public.ratings (user_id, sport, mode, mu, sigma, self_assessment, games_played, last_played_at, updated_at)
            values (${before.userId}, ${sport}, ${mode}, ${after.mu}, ${after.sigma}, ${before.selfAssessment},
                    ${before.gamesPlayed + 1}, ${playedAt}, now())
            on conflict (user_id, sport, mode) do update
              set mu = excluded.mu, sigma = excluded.sigma, games_played = excluded.games_played,
                  last_played_at = excluded.last_played_at, updated_at = now()`;
          await tx`
            insert into public.rating_history (user_id, sport, mode, match_id, reason, mu_before, sigma_before, mu_after, sigma_after)
            values (${before.userId}, ${sport}, ${mode}, ${matchId}, 'match',
                    ${before.mu}, ${before.sigma}, ${after.mu}, ${after.sigma})`;
        }
      },
    },
  };
}
