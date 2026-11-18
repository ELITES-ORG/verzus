import { type Rating, winProbability } from '@verzus/rating';

/**
 * Matchmaking rules. Pure functions: callers pass ratings and how long each
 * match has been open; nothing here reads the clock or the database.
 */

export const MATCHMAKING_TUNING = {
  /** Ranked matches first show only games within 50% ± this. */
  initialMaxEdge: 0.1,
  /** The allowed edge grows by this much… */
  widenStep: 0.05,
  /** …for every this many minutes nobody has joined. */
  widenEveryMinutes: 15,
  /** Never wider than this (0.5 would allow any game). */
  maxEdge: 0.35,
} as const;

/** How far from 50/50 a ranked game may be, given how long the match has waited. */
export function allowedEdge(minutesOpen: number): number {
  const t = MATCHMAKING_TUNING;
  const steps = Math.max(0, Math.floor(minutesOpen / t.widenEveryMinutes));
  return Math.min(t.maxEdge, t.initialMaxEdge + steps * t.widenStep);
}

export interface OpenMatch {
  id: string;
  mode: 'ranked' | 'casual';
  teamSize: number;
  /** Ratings of players already in each team (for this match's sport and mode). */
  teams: [Rating[], Rating[]];
  minutesOpen: number;
}

export interface Suggestion {
  matchId: string;
  /** Team the candidate would join (0 or 1). */
  team: 0 | 1;
  /** Candidate's team's chance to win if they join. */
  winChance: number;
  /** Distance from a 50/50 game; lower is fairer. */
  edge: number;
}

/**
 * Best open spot for one candidate in one match, or null if the match is full
 * or (in ranked mode) the fairest spot is still outside the allowed edge.
 */
export function evaluate(candidate: Rating, match: OpenMatch): Suggestion | null {
  let best: Suggestion | null = null;
  for (const team of [0, 1] as const) {
    if (match.teams[team].length >= match.teamSize) continue;
    const joined: [Rating[], Rating[]] = [[...match.teams[0]], [...match.teams[1]]];
    joined[team].push(candidate);
    // An empty side has no strength yet; treat the game as even for now.
    const winChance = joined[0].length === 0 || joined[1].length === 0 ? 0.5 : winProbability(joined[0], joined[1])[team];
    const edge = Math.abs(winChance - 0.5);
    if (!best || edge < best.edge) best = { matchId: match.id, team, winChance, edge };
  }
  if (!best) return null;
  if (match.mode === 'ranked' && best.edge > allowedEdge(match.minutesOpen)) return null;
  return best;
}

/** Fairest games first. Casual matches are never filtered out, only sorted. */
export function suggest(candidate: Rating, matches: readonly OpenMatch[]): Suggestion[] {
  return matches
    .map((m) => evaluate(candidate, m))
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => a.edge - b.edge);
}
