import { defineConfig } from 'vite';

export default defineConfig({
  // allowedHosts: `pnpm tunnel` serves the dev server through Cloudflare quick tunnels.
  server: { port: 5174, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4174, strictPort: true },
});
