# Fase 2 — Toolchain & perf — Implementation Plan (eseguito)

**Goal:** Chiudere le vulnerabilità di `npm audit` (dev) e spezzare il bundle client per rotta.

## Task 1 — npm audit (devDeps) ✅
- 5 vuln (3 moderate, 1 high, 1 critical), **tutte dev-only** (vitest/vite/esbuild/vite-node).
- Fix solo via bump major. Strategia reversibile (tree pulito): `npm audit fix --force`
  → vitest 2→4, vite 5→8; poi `@vitejs/plugin-react` 4→6 per soddisfare il peer `vite@^8`.
- Verifica: tutti i gate verdi (typecheck, lint, 339 test, build), `npm audit` → **0 vulnerabilità**.
- Bundle rigenerato con hash nuovo (no stale). Commit `d2896e6`.

## Task 2 — Code-splitting per rotta ✅
- `client/src/App.tsx`: import statici → `React.lazy(() => import(...))` per Landing/HostApp/
  PlayerApp/Profile/Home, dentro un `<Suspense fallback={null}>`.
- Verifica build: da 1 chunk (430KB) a chunk per vista —
  index 280KB (shared), PlayerApp 38KB, HostApp 18KB, Landing 12KB, Profile/Home piccoli.
  Un telefono su `/join` non scarica più il codice di host/landing.

## Note
- vitest 4 + vite 8 confermati compatibili con la config esistente (env per-file via
  docblock `@vitest-environment jsdom`, setupFiles).
