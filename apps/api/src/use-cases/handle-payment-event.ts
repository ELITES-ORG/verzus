import type { PaymentEvent } from '../ports/payment-provider';
import type { UnitOfWork } from '../ports/repositories';

export type PaymentEventOutcome = 'duplicate' | 'unknown_payment' | 'already_final' | 'confirmed' | 'hold_lapsed' | 'failed';

/**
 * Applies one verified webhook event. Idempotent: a resent event is recorded
 * once and ignored afterwards, so nothing is confirmed or credited twice.
 */
export async function handlePaymentEvent(
  deps: { uow: UnitOfWork; providerName: string },
  event: PaymentEvent,
): Promise<PaymentEventOutcome> {
  return deps.uow.run(async (repos) => {
    const isNew = await repos.payments.recordWebhookEvent(deps.providerName, event.eventId, event.payload);
    if (!isNew) return 'duplicate';

    const payment = await repos.payments.findByProviderRef(deps.providerName, event.providerRef);
    if (!payment) return 'unknown_payment';
    if (payment.status !== 'pending') return 'already_final';

    if (event.type === 'payment.failed') {
      await repos.payments.setStatus(payment.id, 'failed');
      return 'failed';
    }

    await repos.payments.setStatus(payment.id, 'succeeded');

    if (payment.purpose === 'booking' && payment.bookingId) {
      const confirmed = await repos.bookings.confirm(payment.bookingId);
      if (!confirmed) {
        // Paid after the hold expired and the slot may be gone. Keep the money
        // on the player's in-app balance for a refund or another booking.
        await repos.ledger.post({
          currency: payment.currency,
          paymentId: payment.id,
          bookingId: payment.bookingId,
          entries: [
            { account: 'provider_clearing', accountId: null, amountCents: -payment.amountCents, kind: 'late_payment' },
            { account: 'player', accountId: payment.userId, amountCents: payment.amountCents, kind: 'late_payment' },
          ],
        });
        return 'hold_lapsed';
      }

      const venueId = await repos.ledger.venueOfBooking(payment.bookingId);
      await repos.ledger.post({
        currency: payment.currency,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        entries: [
          { account: 'provider_clearing', accountId: null, amountCents: -payment.amountCents, kind: 'court_fee' },
          { account: 'venue', accountId: venueId, amountCents: payment.amountCents, kind: 'court_fee' },
        ],
      });
      return 'confirmed';
    }

    // Match-share payments are handled by the join-and-pay flow (not built yet).
    return 'confirmed';
  });
}
