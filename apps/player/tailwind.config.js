/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset'), require('@verzus/tailwind')],
  // The verzus palette's light values on :root; src/lib/theme.tsx switches the theme with vars().
  plugins: [require('@verzus/tailwind/theme-plugin').nativeTheme],
  content: ['./src/**/*.{ts,tsx}'],
  // Must be 'class', not the default 'media': with 'media', NativeWind 4's web runtime throws
  // "Cannot manually set color scheme, as dark mode is type 'media'" when the dev CSS loads
  // after its JS. 'class' also allows an in-app light/dark switch later (`dark` class on <html>).
  darkMode: 'class',
};
