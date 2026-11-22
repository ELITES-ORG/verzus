import type { Sport } from './constants';
import { toPhMobile } from './phone';

/**
 * Account rules for registration and sign-in, with no zod dependency so screens can import them
 * cheaply. They must match the database (supabase/migrations/20261122153653_player_registration.sql):
 * the sign-up trigger checks the same things and refuses a sign-up that breaks them.
 */

/** 3 to 20 lowercase letters, digits, dots or underscores. Usernames are stored lowercase. */
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'] as const;
export type Suffix = (typeof SUFFIXES)[number];

export const PASSWORD_MIN = 8;
/** Supabase Auth (bcrypt) ignores anything past 72 bytes; refuse rather than silently cut. */
export const PASSWORD_MAX = 72;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Why a username can't be used, or null if its form is fine (availability is checked separately). */
export function usernameProblem(input: string): string | null {
  const u = normalizeUsername(input);
  if (u.length < 3) return 'At least 3 characters.';
  if (u.length > 20) return 'At most 20 characters.';
  if (!USERNAME_PATTERN.test(u)) return 'Letters, numbers, dots and underscores only.';
  return null;
}

/** Why a password can't be used, or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters.`;
  if (utf8Bytes(password) > PASSWORD_MAX) return `At most ${PASSWORD_MAX} characters.`;
  return null;
}

function utf8Bytes(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** A plausible email address (the real check is the confirmation email). */
export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/** Everything a player registers with, besides email and password. */
export interface PlayerRegistration {
  username: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: Suffix | '';
  /** Any common form of a PH mobile number; stored as +639XXXXXXXXX. */
  phone: string;
  province: string;
  city: string;
  barangay: string;
  sports: Sport[];
}

/**
 * The sign-up metadata the database's sign-up trigger reads to create the player's profile and
 * private details (handle_new_user). Throws if the phone number isn't a PH mobile number.
 */
export function playerSignUpData(r: PlayerRegistration): Record<string, unknown> {
  const phone = toPhMobile(r.phone);
  if (!phone) throw new Error('Not a Philippine mobile number');
  return {
    kind: 'player',
    username: normalizeUsername(r.username),
    first_name: r.firstName.trim(),
    middle_name: r.middleName?.trim() ?? '',
    last_name: r.lastName.trim(),
    suffix: r.suffix ?? '',
    phone,
    province: r.province.trim(),
    city: r.city.trim(),
    barangay: r.barangay.trim(),
    sports: r.sports,
  };
}
