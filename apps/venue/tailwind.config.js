// The shared preset and theme by file path rather than package name: Tailwind's dev server only
// watches config files it reaches through relative imports, so palette changes show without a restart.
import preset from '../../packages/tailwind/preset.js';
import { webTheme } from '../../packages/tailwind/theme-plugin.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  plugins: [webTheme],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
