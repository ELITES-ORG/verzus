/**
 * Philippine mobile numbers, with no zod dependency so screens can import it cheaply.
 *
 * A PH mobile number is +63 followed by 10 digits starting with 9 (written locally as 09XX XXX
 * XXXX). Venues are reached on mobile only; landlines are not accepted. Numbers are stored in
 * E.164 form: "+639171234567".
 */

/** How many digits follow +63. */
export const PH_MOBILE_DIGITS = 10;

/** Every digit after the country code or leading 0: "0917-123-4567" and "+63 917…" both give "917…". */
function national(input: string): string {
  const d = input.replace(/\D/g, '');
  if (d.startsWith('63')) return d.slice(2);
  if (d.startsWith('0')) return d.slice(1);
  return d;
}

/**
 * For a "+63 [__________]" input: keeps the digits after +63, capped at 10. Pasted or autofilled
 * numbers in any common form ("0917 123 4567", "+63 917 123 4567") come out right.
 */
export function phMobileInput(input: string): string {
  return national(input).slice(0, PH_MOBILE_DIGITS);
}

/** True for a complete PH mobile number in any common form. */
export function isPhMobile(input: string): boolean {
  return /^9\d{9}$/.test(national(input));
}

/** "+639171234567", or null if it isn't a complete PH mobile number. */
export function toPhMobile(input: string): string | null {
  return isPhMobile(input) ? `+63${national(input)}` : null;
}

/** "+63 917 123 4567" for display; anything else comes back unchanged. */
export function formatPhMobile(input: string): string {
  if (!isPhMobile(input)) return input;
  const n = national(input);
  return `+63 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
