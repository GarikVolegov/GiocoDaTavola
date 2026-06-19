import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the Vite server (5173) proxies realtime + API calls to the game server (3000).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/api': { target: 'http://localhost:3000' },
    },
  },
});
