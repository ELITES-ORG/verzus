import { z } from 'zod';
import type { PaymentEvent, PaymentProvider } from '../../ports/payment-provider';

const FakeWebhookBody = z.object({
  eventId: z.string().min(1),
  type: z.enum(['payment.succeeded', 'payment.failed']),
  providerRef: z.string().min(1),
});

/**
 * Stand-in provider for development and tests, until the real one is chosen.
 * Checkouts succeed only when you POST a matching event to /webhooks/fake:
 *   { "eventId": "evt_1", "type": "payment.succeeded", "providerRef": "fake_<payment id>" }
 * Never enable in production: its webhooks are unsigned.
 */
export function createFakePaymentProvider(): PaymentProvider {
  return {
    name: 'fake',
    async createCheckout({ reference }) {
      return { providerRef: `fake_${reference}`, checkoutUrl: null };
    },
    async parseWebhook({ rawBody }): Promise<PaymentEvent> {
      const body = FakeWebhookBody.parse(JSON.parse(rawBody));
      return { ...body, payload: body };
    },
  };
}
