/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset'), require('@verzus/tailwind')],
  content: ['./src/**/*.{ts,tsx}'],
  // Must be 'class', not the default 'media': with 'media', NativeWind 4's web runtime throws
  // "Cannot manually set color scheme, as dark mode is type 'media'" when the dev CSS loads
  // after its JS. 'class' also allows an in-app light/dark switch later (`dark` class on <html>).
  darkMode: 'class',
};
