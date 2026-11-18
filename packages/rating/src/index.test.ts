import { describe, expect, it } from 'vitest';
import {
  applyInactivity,
  applySeasonReset,
  conservativeScore,
  isInPlacement,
  rateMatch,
  startingRating,
  TUNING,
  tierOf,
  winProbability,
} from './index';

describe('startingRating', () => {
  it('sets mu from self-assessment and starts sigma at the maximum', () => {
    expect(startingRating('beginner').mu).toBe(20);
    expect(startingRating('advanced').mu).toBe(30);
    expect(startingRating('intermediate').sigma).toBeCloseTo(TUNING.defaultSigma);
  });
});

describe('conservativeScore and tiers', () => {
  it('is mu minus 3 sigma', () => {
    expect(conservativeScore({ mu: 30, sigma: 2 })).toBe(24);
  });

  it('puts every new player in a low tier, so luck cannot buy a high rank', () => {
    expect(tierOf(startingRating('beginner')).tier).toBe('bronze');
    expect(tierOf(startingRating('advanced')).tier).toBe('silver');
  });

  it('labels divisions from III (bottom) to I (top)', () => {
    expect(tierOf({ mu: 12 + 3 * 1, sigma: 1 }).label).toBe('Gold III'); // score 12
    expect(tierOf({ mu: 18.9 + 3, sigma: 1 }).label).toBe('Gold I'); // score 18.9
    expect(tierOf({ mu: 40, sigma: 1 }).label).toBe('Diamond');
  });
});

describe('rateMatch', () => {
  it('moves the winner up and the loser down', () => {
    const a = startingRating('intermediate');
    const b = startingRating('intermediate');
    const [[a2], [b2]] = rateMatch([[a], [b]], 0);
    expect(a2!.mu).toBeGreaterThan(a.mu);
    expect(b2!.mu).toBeLessThan(b.mu);
    expect(a2!.sigma).toBeLessThan(a.sigma);
  });

  it('handles uneven teams such as 3v2 after a no-show', () => {
    const p = startingRating('intermediate');
    const [t1, t2] = rateMatch(
      [
        [p, p, p],
        [p, p],
      ],
      1,
    );
    expect(t1).toHaveLength(3);
    expect(t2).toHaveLength(2);
    expect(t2[0]!.mu).toBeGreaterThan(p.mu);
  });

  it('rejects an empty team', () => {
    expect(() => rateMatch([[startingRating('beginner')], []], 0)).toThrow();
  });
});

describe('winProbability', () => {
  it('is about 50/50 for equal players and sums to 1', () => {
    const p = startingRating('intermediate');
    const [x, y] = winProbability([p], [p]);
    expect(x).toBeCloseTo(0.5, 5);
    expect(x + y).toBeCloseTo(1, 5);
  });
});

describe('inactivity and seasons', () => {
  it('raises sigma while away, without touching mu, capped at the maximum', () => {
    const r = { mu: 30, sigma: 2 };
    const later = applyInactivity(r, 30);
    expect(later.mu).toBe(30);
    expect(later.sigma).toBeGreaterThan(2);
    expect(applyInactivity(r, 100_000).sigma).toBeCloseTo(TUNING.defaultSigma);
  });

  it('season reset raises sigma rather than zeroing the rating', () => {
    const r = applySeasonReset({ mu: 30, sigma: 2 });
    expect(r).toEqual({ mu: 30, sigma: 2 + TUNING.seasonSigmaBump });
  });
});

describe('isInPlacement', () => {
  it('is true for the first placement games only', () => {
    expect(isInPlacement(0)).toBe(true);
    expect(isInPlacement(TUNING.placementGames)).toBe(false);
  });
});
