import { describe, expect, it } from 'vitest';
import { allowedEdge, evaluate, MATCHMAKING_TUNING, type OpenMatch, suggest } from './index';

const even = { mu: 25, sigma: 3 };
const strong = { mu: 40, sigma: 2 };

function singles(id: string, opener: { mu: number; sigma: number }, mode: OpenMatch['mode'], minutesOpen = 0): OpenMatch {
  return { id, mode, teamSize: 1, teams: [[opener], []], minutesOpen };
}

describe('allowedEdge', () => {
  it('starts narrow and widens over time, up to a cap', () => {
    expect(allowedEdge(0)).toBe(MATCHMAKING_TUNING.initialMaxEdge);
    expect(allowedEdge(15)).toBeCloseTo(0.15);
    expect(allowedEdge(10_000)).toBe(MATCHMAKING_TUNING.maxEdge);
  });
});

describe('evaluate', () => {
  it('suggests an even ranked game straight away', () => {
    const s = evaluate(even, singles('m1', even, 'ranked'));
    expect(s?.team).toBe(1);
    expect(s?.edge).toBeCloseTo(0, 2);
  });

  it('hides a lopsided ranked game until the range has widened enough', () => {
    expect(evaluate(even, singles('m1', strong, 'ranked', 0))).toBeNull();
  });

  it('always shows casual games, however lopsided', () => {
    expect(evaluate(even, singles('m1', strong, 'casual'))).not.toBeNull();
  });

  it('returns null when every spot is taken', () => {
    const full: OpenMatch = { id: 'm', mode: 'casual', teamSize: 1, teams: [[even], [even]], minutesOpen: 0 };
    expect(evaluate(even, full)).toBeNull();
  });
});

describe('suggest', () => {
  it('orders the fairest games first', () => {
    const slightlyStronger = { mu: 28, sigma: 3 };
    const out = suggest(even, [singles('lopsided', slightlyStronger, 'casual'), singles('fair', even, 'casual')]);
    expect(out.map((s) => s.matchId)).toEqual(['fair', 'lopsided']);
  });
});
