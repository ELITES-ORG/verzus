import type { SelfAssessment } from './types';

/**
 * Tiers and display rules. No OpenSkill import, so UI code can show ranks
 * without bundling the rating maths: import from '@verzus/rating/tiers'.
 */

export interface Rating {
  mu: number;
  sigma: number;
}

export const TUNING = {
  /** OpenSkill defaults: mu 25, sigma 25/3. */
  defaultMu: 25,
  defaultSigma: 25 / 3,
  /** Starting mu by self-assessment. Sigma always starts at the maximum. */
  startingMu: { beginner: 20, intermediate: 25, advanced: 30 } satisfies Record<SelfAssessment, number>,
  /** Ranked games shown as "placement" before the tier is shown. */
  placementGames: 5,
  /** Sigma growth per day without a ranked game (added in quadrature). */
  inactivitySigmaPerSqrtDay: 0.25,
  /** Sigma added at the start of each season. */
  seasonSigmaBump: 2,
  /** Lower bound of each tier, on the conservative score (mu − 3·sigma). */
  tierFloors: { bronze: -Infinity, silver: 5, gold: 12, platinum: 19, diamond: 26 },
  /** Divisions per tier below Diamond (III is lowest, I is highest). */
  divisionsPerTier: 3,
} as const;

export type Tier = keyof typeof TUNING.tierFloors;
const TIER_ORDER: readonly Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

/**
 * The number ranks are based on. Subtracting 3·sigma means a new or returning
 * player can't hold a high rank on luck: they climb as the system gets surer.
 */
export function conservativeScore(r: Rating): number {
  return r.mu - 3 * r.sigma;
}

export interface TierPlacement {
  tier: Tier;
  /** 3 = III (lowest) … 1 = I (highest). Null for Diamond, which has no divisions. */
  division: 1 | 2 | 3 | null;
  label: string;
}

export function tierOf(r: Rating): TierPlacement {
  const score = conservativeScore(r);
  let index = 0;
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const t = TIER_ORDER[i] as Tier;
    if (score >= TUNING.tierFloors[t]) {
      index = i;
      break;
    }
  }
  const tier = TIER_ORDER[index] as Tier;
  const name = tier[0]?.toUpperCase() + tier.slice(1);
  if (tier === 'diamond') return { tier, division: null, label: name };

  const next = TIER_ORDER[index + 1] as Tier;
  // Bronze has no lower bound; give it the same width as Silver for division math.
  const floor =
    tier === 'bronze' ? TUNING.tierFloors.silver - (TUNING.tierFloors.gold - TUNING.tierFloors.silver) : TUNING.tierFloors[tier];
  const width = (TUNING.tierFloors[next] - floor) / TUNING.divisionsPerTier;
  const step = Math.min(TUNING.divisionsPerTier - 1, Math.max(0, Math.floor((score - floor) / width)));
  const division = (TUNING.divisionsPerTier - step) as 1 | 2 | 3;
  return { tier, division, label: `${name} ${'I'.repeat(division)}` };
}

export function isInPlacement(rankedGamesPlayed: number): boolean {
  return rankedGamesPlayed < TUNING.placementGames;
}
