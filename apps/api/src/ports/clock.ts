/** Injected so tests can control time (hold expiry, result timeouts, seasons). */
export interface Clock {
  now(): Date;
}
