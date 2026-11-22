import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // allowedHosts: `pnpm tunnel` serves the dev server through Cloudflare quick tunnels.
  server: { port: 5173, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
});
