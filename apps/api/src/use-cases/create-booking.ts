import type { CreateBookingInput } from '@verzus/schemas';
import { AppError } from '../domain/errors';
import type { Clock } from '../ports/clock';
import type { PaymentProvider } from '../ports/payment-provider';
import type { UnitOfWork } from '../ports/repositories';

/** How long an unpaid booking holds the slot before pg_cron releases it. */
export const BOOKING_HOLD_MINUTES = 10;
const MAX_HOURS = 4;
const HOUR_MS = 3_600_000;

export interface CreateBookingDeps {
  uow: UnitOfWork;
  payments: PaymentProvider;
  clock: Clock;
}

/**
 * Hold the slot, then start payment. The hold reserves the slot immediately
 * (the database's exclusion constraint rejects overlaps), so two players can
 * never both pay for it. The payment webhook confirms the booking.
 */
export async function createBooking(deps: CreateBookingDeps, userId: string, input: CreateBookingInput) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const now = deps.clock.now();

  const durationMs = endsAt.getTime() - startsAt.getTime();
  if (startsAt <= now) throw new AppError('invalid_input', 'The slot must start in the future');
  if (durationMs % HOUR_MS !== 0 || durationMs / HOUR_MS > MAX_HOURS) {
    throw new AppError('invalid_input', `Book whole hours, up to ${MAX_HOURS}`);
  }

  const holdExpiresAt = new Date(now.getTime() + BOOKING_HOLD_MINUTES * 60_000);

  const { bookingId, paymentId, priceCents, currency } = await deps.uow.run(async (repos) => {
    const court = await repos.bookings.getCourt(input.courtId);
    if (!court?.bookable) throw new AppError('not_found', 'Court not found');

    const priceCents = (court.hourlyRateCents * durationMs) / HOUR_MS;
    const held = await repos.bookings.insertHeld({
      courtId: court.id,
      startsAt,
      endsAt,
      bookedBy: userId,
      priceCents,
      holdExpiresAt,
    });
    if (held === 'slot_taken') throw new AppError('slot_taken', 'That slot was just taken');

    const payment = await repos.payments.create({
      provider: deps.payments.name,
      userId,
      purpose: 'booking',
      bookingId: held.id,
      matchId: null,
      amountCents: priceCents,
      currency: court.currency,
    });
    return { bookingId: held.id, paymentId: payment.id, priceCents, currency: court.currency };
  });

  // Call the provider after commit: never hold a database transaction open
  // across a network call. If this fails, the hold simply expires.
  const checkout = await deps.payments.createCheckout({
    reference: paymentId,
    amountCents: priceCents,
    currency,
    description: 'Court booking',
  });
  await deps.uow.run((repos) => repos.payments.setProviderRef(paymentId, checkout.providerRef));

  return {
    bookingId,
    paymentId,
    priceCents,
    currency,
    holdExpiresAt: holdExpiresAt.toISOString(),
    checkoutUrl: checkout.checkoutUrl,
  };
}
