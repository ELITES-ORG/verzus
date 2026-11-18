import { isInPlacement, type Rating, tierOf } from '@verzus/rating/tiers';

/**
 * Example data for the versus screen. Names and venues are made up; tiers come
 * from the real tier rules in @verzus/rating so the labels match the app.
 */

export type Sport = 'badminton' | 'basketball' | 'futsal' | 'tennis';

interface Player extends Rating {
  name: string;
  initials: string;
  games: number;
}

interface Rival extends Player {
  venue: string;
  when: string;
  km: number;
}

export const YOU: Record<Sport, Player> = {
  badminton: { name: 'You', initials: 'YOU', mu: 15.0, sigma: 2.1, games: 34 },
  basketball: { name: 'You', initials: 'YOU', mu: 19.4, sigma: 2.3, games: 52 },
  futsal: { name: 'You', initials: 'YOU', mu: 11.2, sigma: 2.6, games: 12 },
  tennis: { name: 'You', initials: 'YOU', mu: 22.0, sigma: 6.4, games: 2 },
};

const RIVALS: Record<Sport, Rival[]> = {
  badminton: [
    { name: 'Bea', initials: 'BR', mu: 15.6, sigma: 1.7, games: 61, venue: 'Smash Hall, BGC', when: 'Thu 19:00', km: 4.2 },
    {
      name: 'Migs',
      initials: 'MD',
      mu: 14.1,
      sigma: 2.6,
      games: 23,
      venue: 'The Shuttle Barn, Kapitolyo',
      when: 'Thu 20:00',
      km: 7.8,
    },
    { name: 'Trish', initials: 'TA', mu: 16.9, sigma: 1.9, games: 88, venue: 'Smash Hall, BGC', when: 'Fri 18:00', km: 4.2 },
    { name: 'Enzo', initials: 'EP', mu: 12.2, sigma: 2.2, games: 40, venue: 'Court 9, Pasig', when: 'Sat 10:00', km: 11.5 },
    {
      name: 'Jas',
      initials: 'JM',
      mu: 15.2,
      sigma: 3.3,
      games: 9,
      venue: 'The Shuttle Barn, Kapitolyo',
      when: 'Sat 16:00',
      km: 7.8,
    },
  ],
  basketball: [
    { name: 'Kiko', initials: 'KS', mu: 19.9, sigma: 2.0, games: 77, venue: 'Hoop Shed, Pasig', when: 'Thu 21:00', km: 9.1 },
    { name: 'Paolo', initials: 'PV', mu: 18.6, sigma: 2.7, games: 31, venue: 'Rooftop Run, Makati', when: 'Fri 20:00', km: 2.4 },
    { name: 'Dani', initials: 'DC', mu: 21.3, sigma: 1.8, games: 102, venue: 'Hoop Shed, Pasig', when: 'Sun 08:00', km: 9.1 },
    {
      name: 'Rico',
      initials: 'RT',
      mu: 17.0,
      sigma: 2.4,
      games: 45,
      venue: 'Barangay Gym 4, Mandaluyong',
      when: 'Sat 17:00',
      km: 5.6,
    },
  ],
  futsal: [
    { name: 'Lia', initials: 'LG', mu: 11.8, sigma: 2.2, games: 19, venue: 'Yard 5, Taguig', when: 'Fri 21:00', km: 3.3 },
    { name: 'Benj', initials: 'BO', mu: 10.1, sigma: 3.0, games: 7, venue: 'Yard 5, Taguig', when: 'Sat 19:00', km: 3.3 },
    { name: 'Carlo', initials: 'CY', mu: 13.5, sigma: 1.9, games: 58, venue: 'Five-a-Side, Ortigas', when: 'Sun 18:00', km: 8.7 },
  ],
  tennis: [
    { name: 'Mara', initials: 'MQ', mu: 21.0, sigma: 3.9, games: 6, venue: 'Clay & Co., Alabang', when: 'Sat 07:00', km: 14.2 },
    { name: 'Gab', initials: 'GL', mu: 23.4, sigma: 5.1, games: 3, venue: 'Hardcourt 2, Makati', when: 'Sun 07:00', km: 3.0 },
    { name: 'Sam', initials: 'SN', mu: 18.2, sigma: 2.4, games: 40, venue: 'Hardcourt 2, Makati', when: 'Sun 16:00', km: 3.0 },
  ],
};

/** Ranked games first show only matches within 50% ± this (initialMaxEdge in @verzus/matchmaking). */
const MAX_EDGE = 0.1;
/** OpenSkill's beta (default sigma / 2). */
const BETA = 25 / 6;

export interface Matchup {
  rival: Rival;
  rivalLabel: string;
  youWin: number;
}

/** Fair games within reach, fairest first. */
export function matchups(sport: Sport, maxKm: number): Matchup[] {
  const you = YOU[sport];
  return RIVALS[sport]
    .filter((r) => r.km <= maxKm)
    .map((rival) => ({ rival, rivalLabel: label(rival), youWin: winChance(you, rival) }))
    .filter((m) => Math.abs(m.youWin - 0.5) <= MAX_EDGE)
    .sort((a, b) => Math.abs(a.youWin - 0.5) - Math.abs(b.youWin - 0.5));
}

export function label(p: Player): string {
  return isInPlacement(p.games) ? `Placement ${p.games}/5` : tierOf(p).label;
}

/** Normal approximation of a 1v1 win chance, as OpenSkill models skill: N(mu, sigma²) plus performance noise beta. */
function winChance(a: Rating, b: Rating): number {
  const spread = Math.sqrt(2 * BETA ** 2 + a.sigma ** 2 + b.sigma ** 2);
  return phi((a.mu - b.mu) / spread);
}

function phi(x: number): number {
  // Abramowitz–Stegun 7.1.26 erf approximation; plenty for a percentage on screen.
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((x / Math.SQRT2) ** 2));
  return 0.5 * (1 + Math.sign(x) * y);
}
