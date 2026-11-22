import { describe, expect, it } from 'vitest';
import { isEmail, normalizeUsername, passwordProblem, playerSignUpData, usernameProblem } from './account';

describe('usernames', () => {
  it('are lowercased and trimmed', () => {
    expect(normalizeUsername('  Maria.S ')).toBe('maria.s');
  });
  it('accept letters, digits, dots and underscores, 3 to 20 long', () => {
    expect(usernameProblem('maria_s.2')).toBeNull();
    expect(usernameProblem('Maria')).toBeNull();
    expect(usernameProblem('ab')).toMatch(/at least 3/i);
    expect(usernameProblem('a'.repeat(21))).toMatch(/at most 20/i);
    expect(usernameProblem('maria s')).toMatch(/letters/i);
    expect(usernameProblem('maría')).toMatch(/letters/i);
  });
});

describe('passwords', () => {
  it('need at least 8 characters and at most 72 bytes', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/i);
    expect(passwordProblem('long enough')).toBeNull();
    expect(passwordProblem('x'.repeat(73))).toMatch(/at most 72/i);
  });
});

describe('emails', () => {
  it('need a name, an @ and a domain', () => {
    expect(isEmail('maria@example.com')).toBe(true);
    expect(isEmail('maria@example')).toBe(false);
    expect(isEmail('maria example.com')).toBe(false);
  });
});

describe('playerSignUpData', () => {
  const base = {
    username: ' Maria.S ',
    firstName: ' Maria ',
    lastName: 'Santos',
    phone: '0917 123 4567',
    province: 'Cebu',
    city: 'Cebu City',
    barangay: 'Lahug',
    sports: ['badminton' as const],
  };
  it('is the shape the sign-up trigger reads, with the phone in +63 form', () => {
    expect(playerSignUpData(base)).toEqual({
      kind: 'player',
      username: 'maria.s',
      first_name: 'Maria',
      middle_name: '',
      last_name: 'Santos',
      suffix: '',
      phone: '+639171234567',
      province: 'Cebu',
      city: 'Cebu City',
      barangay: 'Lahug',
      sports: ['badminton'],
    });
  });
  it('refuses a number that is not a PH mobile', () => {
    expect(() => playerSignUpData({ ...base, phone: '02 8123 4567' })).toThrow();
  });
});
