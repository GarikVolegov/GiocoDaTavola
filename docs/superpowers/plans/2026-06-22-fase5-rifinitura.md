# Fase 5 — Rifinitura — Implementation Plan (eseguito)

**Goal:** Misurare/guardare la coverage, restringere il CORS in prod, rendere il
health-check informativo sul DB. (Eseguita prima della Fase 4 perché indipendente
dal refactor e a basso rischio.)

## Task 1 — CORS ristretto via env ✅
- `index.ts`: Socket.IO `cors.origin = process.env.CLIENT_ORIGIN || '*'`.
- Prod: imposta `CLIENT_ORIGIN` all'origine di deploy; dev resta `*`. Default sicuro.

## Task 2 — Health-check sul DB ✅
- `GET /api/health` → `{ ok: true, db: 'disabled' | 'ok' | 'down' }`.
  Con DB abilitato fa `SELECT 1`; `ok:true` anche se il DB è giù (il gioco gira in memoria).
- Test in `integration.test.ts`: `fetch /api/health` → `ok:true`, `db:'disabled'` (DB-less in test).

## Task 3 — Coverage con soglie ✅
- `@vitest/coverage-v8`; config in `vitest.config.ts` scoped a `server/src/game/**`
  + `rateLimit.ts`, reporter text-summary, soglie statements 90 / branches 82 /
  functions 90 / lines 92 (sotto i valori attuali ~93/85/95/96 → guard anti-regressione).
- Script root `coverage`; step CI dedicato; `coverage/` in `.gitignore`.

## Note
- Coverage gira solo sotto `--coverage` (non rallenta `npm test`).
- 344 test, tutti i gate verdi, coverage exit 0.
