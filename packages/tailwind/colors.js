/**
 * verzus brand tokens: green. Green means go (main buttons, chosen, done); red means danger
 * (errors, delete) and nothing else. Change values here and both apps follow.
 * - brand-500 is the bright green of the logo's "v" and of marks with no text on them.
 * - brand-600 is for white text on green (5.0:1, WCAG AA) and green text on light grounds.
 */
const brand = {
  50: '#effdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#15803d',
  700: '#166534',
  800: '#14532d',
  900: '#0f3f22',
  950: '#052e16',
};

/** Danger: errors, missing required fields, delete. 300 is for text on dark grounds. */
const danger = {
  50: '#fdecee',
  100: '#fbd5d9',
  200: '#f8b0b7',
  300: '#ff8a92',
  400: '#f0545e',
  500: '#dd2b37',
  600: '#c0222e',
  700: '#b51f2a',
  800: '#8a1a23',
  900: '#701a22',
  950: '#3d080d',
};

const ink = {
  50: '#f6f7f9',
  100: '#eceef2',
  200: '#d5d9e2',
  300: '#b1b9c8',
  400: '#8693aa',
  500: '#67758f',
  600: '#525e76',
  700: '#434c60',
  800: '#3a4151',
  900: '#1f232c',
  950: '#12141a',
};

/** Rank tier badge colors (Bronze → Diamond). */
const tier = {
  bronze: '#b0703c',
  silver: '#9aa4b1',
  gold: '#e3a915',
  platinum: '#3fb7a8',
  diamond: '#5b8cff',
};

module.exports = { brand, danger, ink, tier };
