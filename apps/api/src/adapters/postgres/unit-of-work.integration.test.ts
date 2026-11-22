import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmResult } from '../../use-cases/confirm-result';
import { createBooking } from '../../use-cases/create-booking';
import { handlePaymentEvent } from '../../use-cases/handle-payment-event';
import { createFakePaymentProvider } from '../payments/fake';
import { createPostgresUnitOfWork, createSql } from './unit-of-work';

/**
 * Runs the use cases against a real local database. Skipped unless
 * TEST_DATABASE_URL is set, e.g.:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55422/postgres pnpm --filter @verzus/api test
 * Uses fresh random ids, so it can run repeatedly; `supabase db reset` clears the leftovers.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Postgres adapter (integration)', () => {
  const sql = createSql(url ?? '');
  const uow = createPostgresUnitOfWork(sql);
  const payments = createFakePaymentProvider();
  const clock = { now: () => new Date('2030-01-01T00:00:00Z') };

  afterAll(() => sql.end({ timeout: 5 }));

  it('books, confirms payment once, and rates a confirmed match', async () => {
    const [alice, bob, owner] = [randomUUID(), randomUUID(), randomUUID()];
    const [venue, court] = [randomUUID(), randomUUID()];
    await sql`insert into auth.users (id, email) values
      (${alice}, ${`${alice}@test.local`}), (${bob}, ${`${bob}@test.local`}), (${owner}, ${`${owner}@test.local`})`;
    // New accounts wait for an admin; these are approved.
    await sql`update public.account_reviews set status = 'approved' where id in (${alice}, ${bob}, ${owner})`;
    await sql`insert into public.venues (id, name, address, city, location, status, created_by)
      values (${venue}, 'Integration Courts', '1 Test St', 'Makati',
              extensions.st_setsrid(extensions.st_makepoint(121.02, 14.55), 4326)::extensions.geography, 'live', ${owner})`;
    await sql`insert into public.courts (id, venue_id, name, sport, hourly_rate_cents)
      values (${court}, ${venue}, 'Court 1', 'badminton', 30000)`;

    // Book and pay.
    const slot = { courtId: court, startsAt: '2030-01-02T10:00:00Z', endsAt: '2030-01-02T11:00:00Z' };
    const booking = await createBooking({ uow, payments, clock }, alice, slot);
    await expect(createBooking({ uow, payments, clock }, bob, slot)).rejects.toMatchObject({ code: 'slot_taken' });

    const event = {
      eventId: `evt_${randomUUID()}`,
      type: 'payment.succeeded' as const,
      providerRef: `fake_${booking.paymentId}`,
      payload: {},
    };
    expect(await handlePaymentEvent({ uow, providerName: 'fake' }, event)).toBe('confirmed');
    expect(await handlePaymentEvent({ uow, providerName: 'fake' }, event)).toBe('duplicate');

    const [b] = await sql<{ status: string }[]>`select status from public.bookings where id = ${booking.bookingId}`;
    expect(b?.status).toBe('confirmed');
    const [venueBalance] = await sql<{ total: string }[]>`
      select sum(amount_cents)::text as total from public.ledger_entries where account = 'venue' and account_id = ${venue}`;
    expect(venueBalance?.total).toBe('30000');

    // A played match on that booking, then both players confirm.
    const match = randomUUID();
    await sql`insert into public.matches (id, booking_id, venue_id, court_id, starts_at, ends_at, sport, mode, team_size, status, created_by)
      values (${match}, ${booking.bookingId}, ${venue}, ${court}, ${slot.startsAt}, ${slot.endsAt}, 'badminton', 'ranked', 1, 'played', ${alice})`;
    await sql`insert into public.match_participants (match_id, user_id, team, status, share_cents) values
      (${match}, ${alice}, 1, 'paid', 15000), (${match}, ${bob}, 2, 'paid', 15000)`;

    expect((await confirmResult({ uow, clock }, alice, match, 2)).status).toBe('awaiting_confirmation');
    expect((await confirmResult({ uow, clock }, bob, match, 2)).status).toBe('rated');

    const ratings = await sql<{ user_id: string; mu: number; games_played: number }[]>`
      select user_id, mu, games_played from public.ratings where user_id in (${alice}, ${bob}) and sport = 'badminton' and mode = 'ranked'`;
    const mu = Object.fromEntries(ratings.map((r) => [r.user_id, r.mu]));
    expect(ratings).toHaveLength(2);
    expect(mu[bob]).toBeGreaterThan(mu[alice] as number);

    const [m] = await sql<
      { status: string; winning_team: number }[]
    >`select status, winning_team from public.matches where id = ${match}`;
    expect(m).toEqual({ status: 'rated', winning_team: 2 });
  });
});
