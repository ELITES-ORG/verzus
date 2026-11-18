import { rating as osRating, predictWin, rate } from 'openskill';
import { type Rating, TUNING } from './tiers';
import type { SelfAssessment } from './types';

export type { SelfAssessment } from './types';

/**
 * verzus rating rules on top of OpenSkill (Plackett-Luce, the library default).
 * Pure functions only: no database, no clock. The API loads ratings, calls these,
 * and writes the results in one transaction.
 *
 * Every tunable number lives in TUNING so it can be adjusted from real data.
 */

export * from './tiers';

/** A brand-new rating for one sport, from the player's self-assessment. */
export function startingRating(self: SelfAssessment): Rating {
  return osRating({ mu: TUNING.startingMu[self], sigma: TUNING.defaultSigma });
}

/**
 * Rate a finished two-team match (win/loss only). Teams may be uneven, e.g. 3v2
 * after a no-show. Returns new ratings in the same shape as the input.
 */
export function rateMatch(teams: readonly [readonly Rating[], readonly Rating[]], winner: 0 | 1): [Rating[], Rating[]] {
  if (teams[0].length === 0 || teams[1].length === 0) {
    throw new Error('Both teams need at least one player');
  }
  const rank = winner === 0 ? [1, 2] : [2, 1];
  const [a, b] = rate([teams[0].map(clean), teams[1].map(clean)], { rank });
  return [a ?? [], b ?? []];
}

/** Probability that each team wins, e.g. [0.62, 0.38]. */
export function winProbability(teamA: readonly Rating[], teamB: readonly Rating[]): [number, number] {
  const [pA = 0.5, pB = 0.5] = predictWin([teamA.map(clean), teamB.map(clean)]);
  return [pA, pB];
}

/** Raise sigma for time away, so a returning player re-settles quickly. No mu penalty. */
export function applyInactivity(r: Rating, daysInactive: number): Rating {
  if (daysInactive <= 0) return { ...r };
  const add = TUNING.inactivitySigmaPerSqrtDay ** 2 * daysInactive;
  return { mu: r.mu, sigma: Math.min(TUNING.defaultSigma, Math.sqrt(r.sigma ** 2 + add)) };
}

/** Season start: raise sigma instead of resetting to zero. */
export function applySeasonReset(r: Rating): Rating {
  return { mu: r.mu, sigma: Math.min(TUNING.defaultSigma, r.sigma + TUNING.seasonSigmaBump) };
}

function clean(r: Rating): Rating {
  return { mu: r.mu, sigma: r.sigma };
}
