// Service worker for the PWA, generated after `expo export -p web` (see the "build" script).
// Caches the app shell only: booking and joining always need a connection.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,ttf,ico,json,png,css}'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
};
