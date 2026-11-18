import { defineConfig } from 'tsup';

// Bundles the server and each cron job into dist/. Workspace packages
// (@verzus/*) are TypeScript source, so they are bundled in; npm packages stay external.
export default defineConfig({
  entry: ['src/index.ts', 'src/jobs/inactivity-decay.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@verzus\//],
});
