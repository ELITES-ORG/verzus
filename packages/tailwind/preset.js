/**
 * Shared Tailwind CSS v3 preset. NativeWind v4 (player app) requires Tailwind v3,
 * so the venue dashboard uses v3 too and both load this one preset.
 * @type {import('tailwindcss').Config}
 */
const { brand, ink, tier } = require('./colors');

module.exports = {
  content: [],
  theme: {
    extend: {
      colors: { brand, ink, tier },
      borderRadius: {
        card: '14px',
      },
    },
  },
};
