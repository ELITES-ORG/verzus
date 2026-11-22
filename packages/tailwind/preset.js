/**
 * Shared Tailwind CSS v3 preset. NativeWind v4 (player app) requires Tailwind v3,
 * so the venue dashboard uses v3 too and both load this one preset.
 *
 * Two kinds of colour:
 * - Fixed scales (brand, danger, ink, tier) from colors.js: the same in every theme.
 * - Theme colours (canvas, surface, fg, accent, ...) read the CSS variables in theme.css, so they
 *   switch between light and dark. New screens use these.
 * @type {import('tailwindcss').Config}
 */
const { brand, danger, ink, tier } = require('./colors');

/** A theme colour: an RGB-channel CSS variable that keeps Tailwind's opacity modifiers working. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        brand,
        ink,
        tier,
        // danger-50 ... danger-950 stay fixed; `danger` and `danger-soft` follow the theme.
        danger: { ...danger, DEFAULT: v('danger'), soft: v('danger-soft') },
        canvas: v('canvas'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        fg: { DEFAULT: v('fg'), 2: v('fg-2'), 3: v('fg-3') },
        accent: { DEFAULT: v('accent'), hover: v('accent-hover'), soft: v('accent-soft'), 'soft-fg': v('accent-soft-fg') },
        'on-accent': v('on-accent'),
        mark: v('mark'),
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
        scrim: v('scrim'),
      },
      borderRadius: {
        card: '14px',
        // Sharp, slightly softened. Round only what is round by nature (switches, avatars, dots).
        chip: '4px', // tags, thumbnails, small tiles
        control: '5px', // buttons, fields, chips, notes
        panel: '6px', // cards, sheets, dialogs
      },
    },
  },
};
