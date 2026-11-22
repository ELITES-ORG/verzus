import { describe, expect, it } from 'vitest';
import { formatPhMobile, isPhMobile, phMobileInput, toPhMobile } from './phone';

describe('isPhMobile', () => {
  it.each(['9171234567', '09544498779', '0917 123 4567', '0917-123-4567', '+63 917 123 4567', '+639171234567', '639171234567'])(
    'accepts %s',
    (n) => {
      expect(isPhMobile(n)).toBe(true);
    },
  );

  it.each([
    '',
    '917123456', // a digit short
    '91712345678', // a digit long
    '0917 123 45678',
    '8171234567', // mobile numbers start with 9
    '(02) 8123 4567', // landline
    '+1 415 555 0100',
    'call us',
  ])('rejects %j', (n) => {
    expect(isPhMobile(n)).toBe(false);
  });
});

describe('phMobileInput', () => {
  it('keeps only the digits after +63, at most 10', () => {
    expect(phMobileInput('917 123 4567')).toBe('9171234567');
    expect(phMobileInput('91712345678999')).toBe('9171234567');
    expect(phMobileInput('9a1b7')).toBe('917');
  });

  it('turns pasted or autofilled numbers into the part after +63', () => {
    expect(phMobileInput('09171234567')).toBe('9171234567');
    expect(phMobileInput('+63 917 123 4567')).toBe('9171234567');
  });
});

describe('toPhMobile / formatPhMobile', () => {
  it('stores E.164 and shows it grouped', () => {
    expect(toPhMobile('0954 449 8779')).toBe('+639544498779');
    expect(toPhMobile('954449877')).toBeNull();
    expect(formatPhMobile('+639544498779')).toBe('+63 954 449 8779');
    expect(formatPhMobile('not a number')).toBe('not a number');
  });
});
