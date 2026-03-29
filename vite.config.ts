import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // BASE_PATH is set by GitHub Actions to match the repo name (e.g. /eyj-manager-2026/).
  // Locally and on root-domain deploys it stays '/'.
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
