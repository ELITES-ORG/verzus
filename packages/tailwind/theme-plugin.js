/**
 * Tailwind plugins that put the verzus palette (themes.js) on :root as CSS variables. Plain
 * functions (Tailwind accepts those as plugins), so this package needs no Tailwind import of its own.
 */
const { light, dark, asVars } = require('./themes');

/**
 * Web (venue app): light by default; dark when the device prefers it, unless the person chose
 * light; dark whenever they chose dark. A choice is `data-theme` on <html> (venue lib/theme.ts,
 * applied before the first paint by index.html). `theme-scheme` makes native controls and
 * scrollbars follow the theme.
 */
const webTheme = ({ addBase }) => {
  const darkVars = { ...asVars(dark), '--scheme': 'dark' };
  addBase({
    ':root': { ...asVars(light), '--scheme': 'light' },
    '@media (prefers-color-scheme: dark)': { ':root:not([data-theme="light"])': darkVars },
    ':root[data-theme="dark"]': darkVars,
    '.theme-scheme': { 'color-scheme': 'var(--scheme)' },
  });
};

/**
 * React Native (player app, NativeWind): the light values as defaults on :root, the pattern
 * NativeWind documents. The theme on screen is applied in JS with `vars()` (player lib/theme.tsx).
 */
const nativeTheme = ({ addBase }) => {
  addBase({ ':root': asVars(light) });
};

module.exports = { webTheme, nativeTheme };
