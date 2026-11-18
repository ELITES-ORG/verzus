/**
 * Plain constants with no zod dependency, for UI code that only needs the
 * lists (importing zod just for these would add hundreds of KB to a screen).
 * Must match the Postgres enums in supabase/migrations.
 */
export const SPORTS = ['basketball', 'badminton', 'futsal', 'tennis', 'volleyball', 'pickleball'] as const;
export type Sport = (typeof SPORTS)[number];

export const MATCH_MODES = ['ranked', 'casual'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const SELF_ASSESSMENTS = ['beginner', 'intermediate', 'advanced'] as const;
export type SelfAssessment = (typeof SELF_ASSESSMENTS)[number];

export const MATCH_STATUSES = [
  'open_allies',
  'open_public',
  'full',
  'played',
  'awaiting_confirmation',
  'rated',
  'disputed',
  'resolved',
  'cancelled',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
