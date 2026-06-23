import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// In dev the Vite server (5173) proxies realtime + API calls to the game server (3000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Keyless boot: with no Clerk publishable key, swap @clerk/react for an inert
  // stub so the app renders (signed-out) instead of throwing on a missing key.
  // Never in tests (they mock @clerk/react) nor when a real key is provided.
  const keyless = mode !== 'test' && !env.VITE_CLERK_PUBLISHABLE_KEY;
  return {
    plugins: [react()],
    resolve: keyless
      ? { alias: { '@clerk/react': fileURLToPath(new URL('./src/shared/clerkStub.tsx', import.meta.url)) } }
      : {},
    server: {
      host: true,
      proxy: {
        '/socket.io': { target: 'http://localhost:3000', ws: true },
        '/api': { target: 'http://localhost:3000' },
      },
    },
  };
});
