/**
 * The verzus palette, light and dark: the one place its values live. Both apps read it:
 * - the venue app (web) through `webTheme` in theme-plugin.js (CSS variables, light/dark switch),
 * - the player app (React Native) through `nativeTheme` plus NativeWind's `vars()` (src/lib/theme.tsx).
 * Tailwind's theme colours (preset.js) read the variables, so `bg-surface`, `text-fg` and the rest
 * follow whichever theme is on.
 *
 * Values are RGB channels ("21 128 61") so Tailwind's opacity modifiers work (`bg-accent/20`).
 *
 * Meanings: green (accent) is go; red (danger) is danger and nothing else; amber (warn) asks for a
 * look; violet is focus and "you are here". Neutrals carry a slight indigo bias from the logo's ink.
 * `accent` takes white text in light (5.0:1) and dark text in dark (`on-accent`); `mark` is the
 * logo's green, for the logo only (its second bar is `violet`).
 */

const light = {
  canvas: '245 245 249',
  surface: '255 255 255',
  'surface-2': '239 239 245',
  'surface-3': '230 229 240',
  line: '225 224 236',
  'line-strong': '201 199 220',
  fg: '22 20 47',
  'fg-2': '75 73 104',
  'fg-3': '108 106 143',
  accent: '21 128 61',
  'accent-hover': '22 101 52',
  'on-accent': '255 255 255',
  'accent-soft': '231 246 236',
  'accent-soft-fg': '20 83 45',
  mark: '34 197 94',
  violet: '90 79 216',
  'violet-soft': '238 236 255',
  danger: '192 34 46',
  'danger-soft': '253 236 238',
  warn: '154 90 6',
  'warn-soft': '253 242 221',
  scrim: '22 20 47',
};

const dark = {
  ...light,
  canvas: '14 13 31',
  surface: '22 21 44',
  'surface-2': '29 27 56',
  'surface-3': '37 35 74',
  line: '43 41 80',
  'line-strong': '59 56 102',
  fg: '241 240 250',
  'fg-2': '184 181 214',
  'fg-3': '143 140 180',
  accent: '34 197 94',
  'accent-hover': '74 222 128',
  'on-accent': '5 46 22',
  'accent-soft': '24 46 51',
  'accent-soft-fg': '134 239 172',
  violet: '184 179 255',
  'violet-soft': '45 43 74',
  danger: '255 138 146',
  'danger-soft': '52 36 57',
  warn: '251 191 36',
  'warn-soft': '52 43 43',
  scrim: '5 4 16',
};

/** { canvas: '245 245 249', ... } -> { '--canvas': '245 245 249', ... } */
const asVars = (theme) => Object.fromEntries(Object.entries(theme).map(([k, v]) => [`--${k}`, v]));

/** A token as a colour React Native understands: 'rgb(21, 128, 61)'. */
const rgb = (theme, name) => `rgb(${theme[name].split(' ').join(', ')})`;

module.exports = { light, dark, asVars, rgb };
