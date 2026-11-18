import type { MatchMode, MatchStatus, SelfAssessment, Sport } from '@verzus/schemas';

/**
 * Data access the use cases need, as interfaces. adapters/postgres implements
 * them with SQL; testing/in-memory.ts implements them for unit tests.
 */

/** Runs `fn` in one database transaction; everything inside commits or nothing does. */
export interface UnitOfWork {
  run<T>(fn: (repos: Repos) => Promise<T>): Promise<T>;
}

export interface Repos {
  bookings: BookingRepo;
  payments: PaymentRepo;
  ledger: LedgerRepo;
  matches: MatchRepo;
  ratings: RatingRepo;
}

// Bookings -------------------------------------------------------------------

export interface CourtForBooking {
  id: string;
  venueId: string;
  hourlyRateCents: number;
  currency: string;
  bookable: boolean;
}

export interface BookingRepo {
  getCourt(courtId: string): Promise<CourtForBooking | null>;
  /** Returns 'slot_taken' when the time overlaps an active booking. */
  insertHeld(input: {
    courtId: string;
    startsAt: Date;
    endsAt: Date;
    bookedBy: string;
    priceCents: number;
    holdExpiresAt: Date;
  }): Promise<{ id: string } | 'slot_taken'>;
  /** Confirms a held booking. Returns false if it is no longer held (e.g. expired). */
  confirm(bookingId: string): Promise<boolean>;
}

// Payments and ledger --------------------------------------------------------

export interface PaymentRecord {
  id: string;
  userId: string;
  purpose: 'booking' | 'match_share';
  bookingId: string | null;
  matchId: string | null;
  amountCents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
}

export interface PaymentRepo {
  create(input: Omit<PaymentRecord, 'id' | 'status'> & { provider: string }): Promise<{ id: string }>;
  setProviderRef(paymentId: string, providerRef: string): Promise<void>;
  findByProviderRef(provider: string, providerRef: string): Promise<PaymentRecord | null>;
  setStatus(paymentId: string, status: PaymentRecord['status']): Promise<void>;
  /** Records a webhook event id. Returns false if it was already processed. */
  recordWebhookEvent(provider: string, eventId: string, payload: unknown): Promise<boolean>;
}

export interface LedgerEntry {
  account: 'player' | 'venue' | 'platform' | 'provider_clearing';
  accountId: string | null;
  /**
   * Signed. Negative legs are where money comes from, positive legs who now
   * holds it. provider_clearing is money received from outside (card, GCash…);
   * a player's balance is in-app credit; a venue's balance is owed to it.
   * Example — booking paid by card: provider_clearing −X, venue +X.
   */
  amountCents: number;
  kind: string;
}

export interface LedgerRepo {
  /** Posts entries as one transaction. They must sum to zero. */
  post(input: {
    currency: string;
    entries: LedgerEntry[];
    paymentId?: string;
    bookingId?: string;
    matchId?: string;
  }): Promise<void>;
  venueOfBooking(bookingId: string): Promise<string>;
}

// Matches and ratings -----------------------------------------------------------

export interface MatchForResult {
  id: string;
  sport: Sport;
  mode: MatchMode;
  status: MatchStatus;
  /** Paid players only. */
  players: { userId: string; team: 1 | 2 }[];
  confirmations: { userId: string; winningTeam: 1 | 2 }[];
}

export interface MatchRepo {
  /** Loads and locks the match row for the rest of the transaction. */
  getForResult(matchId: string): Promise<MatchForResult | null>;
  addConfirmation(matchId: string, userId: string, winningTeam: 1 | 2): Promise<void>;
  setStatus(matchId: string, status: MatchStatus, winningTeam?: 1 | 2): Promise<void>;
  openDispute(matchId: string, raisedBy: string, reason: string): Promise<void>;
}

export interface StoredRating {
  userId: string;
  mu: number;
  sigma: number;
  selfAssessment: SelfAssessment;
  gamesPlayed: number;
}

export interface RatingRepo {
  /** Loads and locks ratings (in user id order, to avoid deadlocks). Missing users are omitted. */
  getForUpdate(userIds: string[], sport: Sport, mode: MatchMode): Promise<Map<string, StoredRating>>;
  /** Upserts new ratings and appends one history row each. */
  saveAfterMatch(input: {
    sport: Sport;
    mode: MatchMode;
    matchId: string;
    playedAt: Date;
    changes: { before: StoredRating; after: { mu: number; sigma: number } }[];
  }): Promise<void>;
}
