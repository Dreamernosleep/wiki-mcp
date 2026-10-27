import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // In development the API runs separately on :3000; proxy so the app can
    // use the same relative "/api" base it uses in production behind nginx.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
