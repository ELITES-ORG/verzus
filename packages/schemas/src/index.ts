import { z } from 'zod';
import { PASSWORD_MAX, USERNAME_PATTERN } from './account';
import { MATCH_MODES, MATCH_STATUSES, SELF_ASSESSMENTS, SPORTS } from './constants';

/**
 * Shared vocabulary and input schemas. The apps validate forms with these and
 * the API validates request bodies with the same objects, so both sides agree.
 * Enum values live in ./constants (zod-free, for lightweight UI imports).
 */

export * from './constants';

export const Sport = z.enum(SPORTS);
export type Sport = z.infer<typeof Sport>;

export const MatchMode = z.enum(MATCH_MODES);
export type MatchMode = z.infer<typeof MatchMode>;

/** Players per side. 1 = singles, 2 = doubles, 3 = 3v3, 5 = 5v5. */
export const TeamSize = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type TeamSize = z.infer<typeof TeamSize>;

export const SelfAssessment = z.enum(SELF_ASSESSMENTS);
export type SelfAssessment = z.infer<typeof SelfAssessment>;

export const MatchStatus = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const Uuid = z.uuid();

/** POST /bookings — reserve a court slot. Times are ISO strings with an offset. */
export const CreateBookingInput = z
  .object({
    courtId: Uuid,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;

/** POST /matches — open a booked slot as a match. */
export const OpenMatchInput = z.object({
  bookingId: Uuid,
  mode: MatchMode,
  teamSize: TeamSize,
  /** Allies invited before the remaining spots go public. */
  allyIds: z.array(Uuid).max(9).default([]),
});
export type OpenMatchInput = z.infer<typeof OpenMatchInput>;

/** POST /matches/:id/join */
export const JoinMatchInput = z.object({
  team: z.union([z.literal(1), z.literal(2)]),
});
export type JoinMatchInput = z.infer<typeof JoinMatchInput>;

/** POST /matches/:id/result — win/loss only in the MVP. */
export const ConfirmResultInput = z.object({
  winningTeam: z.union([z.literal(1), z.literal(2)]),
});
export type ConfirmResultInput = z.infer<typeof ConfirmResultInput>;

/**
 * POST /auth/username-sign-in. Sign-in with an email goes straight to Supabase; a username needs
 * the API, which looks up the email on the server (it is never sent to the browser).
 */
export const UsernameSignInInput = z.object({
  username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN),
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type UsernameSignInInput = z.infer<typeof UsernameSignInInput>;

/** POST /matches/:id/dispute */
export const DisputeResultInput = z.object({
  reason: z.string().trim().min(5).max(500),
});
export type DisputeResultInput = z.infer<typeof DisputeResultInput>;
