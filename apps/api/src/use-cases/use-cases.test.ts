import { describe, expect, it } from 'vitest';
import { AppError } from '../domain/errors';
import { createMemoryUnitOfWork, emptyState, fixedClock, ratingKey, stubPayments } from '../testing/in-memory';
import { confirmResult } from './confirm-result';
import { createBooking } from './create-booking';
import { handlePaymentEvent } from './handle-payment-event';

const NOW = '2026-12-01T08:00:00+08:00';
const COURT = '11111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';
const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup() {
  const state = emptyState();
  state.courts.push({ id: COURT, venueId: VENUE, hourlyRateCents: 30000, currency: 'PHP', bookable: true });
  const payments = stubPayments();
  const deps = { uow: createMemoryUnitOfWork(state), payments, clock: fixedClock(NOW) };
  return { state, payments, deps };
}

const slot = { courtId: COURT, startsAt: '2026-12-01T18:00:00+08:00', endsAt: '2026-12-01T20:00:00+08:00' };

describe('createBooking', () => {
  it('holds the slot, prices it by the hour and starts a checkout', async () => {
    const { state, payments, deps } = setup();
    const out = await createBooking(deps, ALICE, slot);
    expect(out.priceCents).toBe(60000);
    expect(state.bookings[0]?.status).toBe('held');
    expect(payments.checkouts).toEqual([out.paymentId]);
    expect(state.payments[0]?.providerRef).toBe(`stub_${out.paymentId}`);
  });

  it('refuses an overlapping slot, and leaves no orphan payment behind', async () => {
    const { state, deps } = setup();
    await createBooking(deps, ALICE, slot);
    await expect(
      createBooking(deps, BOB, { ...slot, startsAt: '2026-12-01T19:00:00+08:00', endsAt: '2026-12-01T21:00:00+08:00' }),
    ).rejects.toMatchObject({
      code: 'slot_taken',
    });
    expect(state.payments).toHaveLength(1);
  });

  it('rejects slots in the past and partial hours', async () => {
    const { deps } = setup();
    await expect(createBooking(deps, ALICE, { ...slot, startsAt: '2026-11-30T18:00:00+08:00' })).rejects.toBeInstanceOf(AppError);
    await expect(createBooking(deps, ALICE, { ...slot, endsAt: '2026-12-01T18:30:00+08:00' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

describe('handlePaymentEvent', () => {
  it('confirms the booking, credits the venue, and ignores a resent webhook', async () => {
    const { state, deps } = setup();
    const { paymentId } = await createBooking(deps, ALICE, slot);
    const event = { eventId: 'evt_1', type: 'payment.succeeded' as const, providerRef: `stub_${paymentId}`, payload: {} };
    const handle = () => handlePaymentEvent({ uow: deps.uow, providerName: 'stub' }, event);

    expect(await handle()).toBe('confirmed');
    expect(await handle()).toBe('duplicate');
    expect(state.bookings[0]?.status).toBe('confirmed');
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]?.entries).toContainEqual({
      account: 'venue',
      accountId: VENUE,
      amountCents: 60000,
      kind: 'court_fee',
    });
  });

  it('keeps a late payment as player credit when the hold already lapsed', async () => {
    const { state, deps } = setup();
    const { paymentId } = await createBooking(deps, ALICE, slot);
    state.bookings[0]!.status = 'expired';
    const out = await handlePaymentEvent(
      { uow: deps.uow, providerName: 'stub' },
      { eventId: 'evt_2', type: 'payment.succeeded', providerRef: `stub_${paymentId}`, payload: {} },
    );
    expect(out).toBe('hold_lapsed');
    expect(state.ledger[0]?.entries).toContainEqual({
      account: 'player',
      accountId: ALICE,
      amountCents: 60000,
      kind: 'late_payment',
    });
  });
});

describe('confirmResult', () => {
  function withMatch(mode: 'ranked' | 'casual' = 'ranked') {
    const s = setup();
    s.state.matches.push({
      id: 'match-1',
      sport: 'badminton',
      mode,
      status: 'played',
      players: [
        { userId: ALICE, team: 1 },
        { userId: BOB, team: 2 },
      ],
      confirmations: [],
    });
    return s;
  }

  it('waits for every player, then rates the match', async () => {
    const { state, deps } = withMatch();
    expect((await confirmResult(deps, ALICE, 'match-1', 1)).status).toBe('awaiting_confirmation');
    expect(state.ratings.size).toBe(0);

    expect((await confirmResult(deps, BOB, 'match-1', 1)).status).toBe('rated');
    const alice = state.ratings.get(ratingKey(ALICE, 'badminton', 'ranked'));
    const bob = state.ratings.get(ratingKey(BOB, 'badminton', 'ranked'));
    expect(alice!.mu).toBeGreaterThan(bob!.mu);
    expect(state.ratingHistory).toHaveLength(2);
  });

  it('opens a dispute instead of rating when players disagree', async () => {
    const { state, deps } = withMatch();
    await confirmResult(deps, ALICE, 'match-1', 1);
    expect((await confirmResult(deps, BOB, 'match-1', 2)).status).toBe('disputed');
    expect(state.ratings.size).toBe(0);
    expect(state.disputes).toHaveLength(1);
  });

  it('updates only the casual rating for casual matches', async () => {
    const { state, deps } = withMatch('casual');
    await confirmResult(deps, ALICE, 'match-1', 2);
    await confirmResult(deps, BOB, 'match-1', 2);
    expect(state.ratings.has(ratingKey(BOB, 'badminton', 'casual'))).toBe(true);
    expect(state.ratings.has(ratingKey(BOB, 'badminton', 'ranked'))).toBe(false);
  });

  it('rejects outsiders and double confirmations', async () => {
    const { deps } = withMatch();
    await expect(confirmResult(deps, VENUE, 'match-1', 1)).rejects.toMatchObject({ code: 'forbidden' });
    await confirmResult(deps, ALICE, 'match-1', 1);
    await expect(confirmResult(deps, ALICE, 'match-1', 1)).rejects.toMatchObject({ code: 'already_confirmed' });
  });
});
