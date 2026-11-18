import { type Rating, rateMatch, startingRating } from '@verzus/rating';
import type { MatchStatus } from '@verzus/schemas';
import { AppError } from '../domain/errors';
import type { Clock } from '../ports/clock';
import type { StoredRating, UnitOfWork } from '../ports/repositories';

const CONFIRMABLE: readonly MatchStatus[] = ['played', 'awaiting_confirmation'];

/**
 * One player confirms the result. When every player has confirmed:
 *  - all agree  → ratings update in this same transaction, match becomes 'rated'
 *  - any differ → match becomes 'disputed' and no rating changes
 * Casual matches update the hidden casual rating; ranked matches the visible one.
 */
export async function confirmResult(
  deps: { uow: UnitOfWork; clock: Clock },
  userId: string,
  matchId: string,
  winningTeam: 1 | 2,
): Promise<{ status: MatchStatus }> {
  return deps.uow.run(async (repos) => {
    const match = await repos.matches.getForResult(matchId);
    if (!match) throw new AppError('not_found', 'Match not found');
    if (!match.players.some((p) => p.userId === userId)) {
      throw new AppError('forbidden', 'Only players in this match can confirm its result');
    }
    if (!CONFIRMABLE.includes(match.status)) {
      throw new AppError('invalid_state', `Results can't be confirmed while the match is ${match.status}`);
    }
    if (match.confirmations.some((c) => c.userId === userId)) {
      throw new AppError('already_confirmed', 'You already confirmed this result');
    }

    await repos.matches.addConfirmation(matchId, userId, winningTeam);
    const confirmations = [...match.confirmations, { userId, winningTeam }];

    if (confirmations.length < match.players.length) {
      await repos.matches.setStatus(matchId, 'awaiting_confirmation');
      return { status: 'awaiting_confirmation' as const };
    }

    const agreed = confirmations.every((c) => c.winningTeam === winningTeam);
    if (!agreed) {
      await repos.matches.setStatus(matchId, 'disputed');
      await repos.matches.openDispute(matchId, userId, 'Players reported different winners');
      return { status: 'disputed' as const };
    }

    const ids = match.players.map((p) => p.userId);
    const stored = await repos.ratings.getForUpdate(ids, match.sport, match.mode);
    const current = (id: string): StoredRating =>
      stored.get(id) ?? {
        userId: id,
        // Onboarding should create ratings; fall back to a neutral start if it didn't.
        ...startingRating('intermediate'),
        selfAssessment: 'intermediate',
        gamesPlayed: 0,
      };

    const team1 = match.players.filter((p) => p.team === 1).map((p) => current(p.userId));
    const team2 = match.players.filter((p) => p.team === 2).map((p) => current(p.userId));
    const [after1, after2] = rateMatch([team1.map(toRating), team2.map(toRating)], winningTeam === 1 ? 0 : 1);

    await repos.ratings.saveAfterMatch({
      sport: match.sport,
      mode: match.mode,
      matchId,
      playedAt: deps.clock.now(),
      changes: [
        ...team1.map((before, i) => ({ before, after: after1[i] as Rating })),
        ...team2.map((before, i) => ({ before, after: after2[i] as Rating })),
      ],
    });
    await repos.matches.setStatus(matchId, 'rated', winningTeam);
    return { status: 'rated' as const };
  });
}

function toRating(r: StoredRating): Rating {
  return { mu: r.mu, sigma: r.sigma };
}
