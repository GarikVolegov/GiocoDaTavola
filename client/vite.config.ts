import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Injects all built JS/CSS/font chunks from `dist/assets/` into `dist/sw.js`
 * and stamps a content-based `CACHE_NAME` so every route (including lazy-loaded
 * `/passa`) works 100% offline immediately after the first visit.
 */
function precacheServiceWorkerPlugin(): Plugin {
  return {
    name: 'precache-service-worker',
    apply: 'build',
    closeBundle() {
      const distDir = fileURLToPath(new URL('./dist', import.meta.url));
      const swPath = path.join(distDir, 'sw.js');
      const assetsDir = path.join(distDir, 'assets');
      if (!fs.existsSync(swPath) || !fs.existsSync(assetsDir)) return;

      const assetFiles = fs
        .readdirSync(assetsDir)
        .filter((f) => /\.(js|css|woff2|svg|png|webp)$/i.test(f))
        .sort()
        .map((f) => `/assets/${f}`);

      const hash = crypto
        .createHash('sha256')
        .update(assetFiles.join('|'))
        .digest('hex')
        .slice(0, 10);

      let sw = fs.readFileSync(swPath, 'utf8');
      sw = sw.replace(
        "const CACHE_NAME = 'nexus-shell-dev';",
        `const CACHE_NAME = 'nexus-shell-${hash}';`,
      );
      sw = sw.replace(
        'const PRECACHE_ASSETS = [];',
        `const PRECACHE_ASSETS = ${JSON.stringify(assetFiles, null, 2)};`,
      );
      fs.writeFileSync(swPath, sw, 'utf8');
    },
  };
}

// In dev the Vite server (5173) proxies realtime + API calls to the game server (3000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Keyless boot: with no Clerk publishable key, swap @clerk/react for an inert
  // stub so the app renders (signed-out) instead of throwing on a missing key.
  // Never in tests (they mock @clerk/react) nor when a real key is provided.
  const keyless = mode !== 'test' && !env.VITE_CLERK_PUBLISHABLE_KEY;
  return {
    plugins: [react(), precacheServiceWorkerPlugin()],
    resolve: keyless
      ? { alias: { '@clerk/react': fileURLToPath(new URL('./src/shared/clerkStub.tsx', import.meta.url)) } }
      : {},
    server: {
      host: true,
      proxy: {
        '/socket.io': { target: `http://localhost:${env.VITE_SERVER_PORT || process.env.PORT || '3001'}`, ws: true },
        '/api': { target: `http://localhost:${env.VITE_SERVER_PORT || process.env.PORT || '3001'}` },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'three-core';
            }
            if (id.includes('node_modules/@clerk')) {
              return 'clerk-vendor';
            }
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
  };
});
