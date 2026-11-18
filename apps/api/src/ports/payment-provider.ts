/**
 * The payment provider is not chosen yet (see the project documentation's
 * "Decide before production deployment"). Use cases depend only on this
 * interface; adapters/payments/ holds one implementation per provider.
 */
export interface PaymentProvider {
  readonly name: string;

  /** Start a checkout for one payment. `reference` is our payments.id. */
  createCheckout(input: {
    reference: string;
    amountCents: number;
    currency: string;
    description: string;
  }): Promise<{ providerRef: string; checkoutUrl: string | null }>;

  /**
   * Verify and parse an incoming webhook. Throws if the signature is invalid.
   * Returns null for event types verzus does not handle.
   */
  parseWebhook(input: { headers: Headers; rawBody: string }): Promise<PaymentEvent | null>;
}

export interface PaymentEvent {
  /** Provider's unique event id, used to ignore resent webhooks. */
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed';
  providerRef: string;
  payload: unknown;
}
