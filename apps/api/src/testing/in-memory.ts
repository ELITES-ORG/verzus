import type { MatchMode, Sport } from '@verzus/schemas';
import type { Clock } from '../ports/clock';
import type { PaymentProvider } from '../ports/payment-provider';
import type {
  CourtForBooking,
  LedgerEntry,
  MatchForResult,
  PaymentRecord,
  StoredRating,
  UnitOfWork,
} from '../ports/repositories';

/**
 * In-memory implementations of the ports, for use-case unit tests.
 * `run` snapshots state and restores it if the callback throws, like a rollback.
 */
export interface MemoryState {
  courts: CourtForBooking[];
  bookings: {
    id: string;
    courtId: string;
    startsAt: Date;
    endsAt: Date;
    status: 'held' | 'confirmed' | 'expired';
    bookedBy: string;
  }[];
  payments: (PaymentRecord & { provider: string; providerRef: string | null })[];
  webhookEvents: Set<string>;
  ledger: { txnId: string; currency: string; entries: LedgerEntry[] }[];
  matches: MatchForResult[];
  disputes: { matchId: string; raisedBy: string; reason: string }[];
  ratings: Map<string, StoredRating & { sport: Sport; mode: MatchMode }>;
  ratingHistory: { userId: string; matchId: string }[];
}

export function emptyState(): MemoryState {
  return {
    courts: [],
    bookings: [],
    payments: [],
    webhookEvents: new Set(),
    ledger: [],
    matches: [],
    disputes: [],
    ratings: new Map(),
    ratingHistory: [],
  };
}

const ratingKey = (userId: string, sport: Sport, mode: MatchMode) => `${userId}|${sport}|${mode}`;

export function createMemoryUnitOfWork(state: MemoryState): UnitOfWork {
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

  return {
    async run(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn({
          bookings: {
            async getCourt(courtId) {
              return state.courts.find((c) => c.id === courtId) ?? null;
            },
            async insertHeld(i) {
              const clash = state.bookings.some(
                (b) =>
                  b.courtId === i.courtId &&
                  (b.status === 'held' || b.status === 'confirmed') &&
                  b.startsAt < i.endsAt &&
                  i.startsAt < b.endsAt,
              );
              if (clash) return 'slot_taken';
              const row = {
                id: id(),
                courtId: i.courtId,
                startsAt: i.startsAt,
                endsAt: i.endsAt,
                status: 'held' as const,
                bookedBy: i.bookedBy,
              };
              state.bookings.push(row);
              return { id: row.id };
            },
            async confirm(bookingId) {
              const b = state.bookings.find((x) => x.id === bookingId && x.status === 'held');
              if (!b) return false;
              b.status = 'confirmed';
              return true;
            },
          },
          payments: {
            async create(i) {
              const row = { ...i, id: id(), status: 'pending' as const, providerRef: null };
              state.payments.push(row);
              return { id: row.id };
            },
            async setProviderRef(paymentId, providerRef) {
              const p = state.payments.find((x) => x.id === paymentId);
              if (p) p.providerRef = providerRef;
            },
            async findByProviderRef(provider, providerRef) {
              return state.payments.find((p) => p.provider === provider && p.providerRef === providerRef) ?? null;
            },
            async setStatus(paymentId, status) {
              const p = state.payments.find((x) => x.id === paymentId);
              if (p) p.status = status;
            },
            async recordWebhookEvent(provider, eventId) {
              const key = `${provider}|${eventId}`;
              if (state.webhookEvents.has(key)) return false;
              state.webhookEvents.add(key);
              return true;
            },
          },
          ledger: {
            async post({ currency, entries }) {
              const sum = entries.reduce((s, e) => s + e.amountCents, 0);
              if (sum !== 0) throw new Error('ledger transaction does not balance');
              state.ledger.push({ txnId: id(), currency, entries });
            },
            async venueOfBooking(bookingId) {
              const b = state.bookings.find((x) => x.id === bookingId);
              const c = state.courts.find((x) => x.id === b?.courtId);
              if (!c) throw new Error('booking not found');
              return c.venueId;
            },
          },
          matches: {
            async getForResult(matchId) {
              // A copy, as a database read would be: later writes must not change it.
              const m = state.matches.find((x) => x.id === matchId);
              return m ? structuredClone(m) : null;
            },
            async addConfirmation(matchId, userId, winningTeam) {
              state.matches.find((m) => m.id === matchId)?.confirmations.push({ userId, winningTeam });
            },
            async setStatus(matchId, status) {
              const m = state.matches.find((x) => x.id === matchId);
              if (m) m.status = status;
            },
            async openDispute(matchId, raisedBy, reason) {
              state.disputes.push({ matchId, raisedBy, reason });
            },
          },
          ratings: {
            async getForUpdate(userIds, sport, mode) {
              const out = new Map<string, StoredRating>();
              for (const u of userIds) {
                const r = state.ratings.get(ratingKey(u, sport, mode));
                if (r) out.set(u, r);
              }
              return out;
            },
            async saveAfterMatch({ sport, mode, matchId, changes }) {
              for (const { before, after } of changes) {
                state.ratings.set(ratingKey(before.userId, sport, mode), {
                  ...before,
                  ...after,
                  gamesPlayed: before.gamesPlayed + 1,
                  sport,
                  mode,
                });
                state.ratingHistory.push({ userId: before.userId, matchId });
              }
            },
          },
        });
      } catch (e) {
        Object.assign(state, snapshot);
        throw e;
      }
    },
  };
}

export function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

export function stubPayments(): PaymentProvider & { checkouts: string[] } {
  const checkouts: string[] = [];
  return {
    name: 'stub',
    checkouts,
    async createCheckout({ reference }) {
      checkouts.push(reference);
      return { providerRef: `stub_${reference}`, checkoutUrl: `https://pay.example/${reference}` };
    },
    async parseWebhook() {
      return null;
    },
  };
}

export { ratingKey };
