# Project conventions — Dibattiti tra amici

Jackbox-style party web game (3–8 players, in person). Shared screen `/host` + phones `/`.
Server-authoritative, in-memory state, **no DB, no accounts**. Social game, no winner —
fun awards at the end. First game phase: **Dilemma di gruppo**.

## Layout
- `server/` — Node + Express + Socket.IO, **TypeScript CommonJS** (tsx in dev, tsc build → `server/dist`).
- `client/` — React + Vite, **TypeScript ESM**. Views split by path in `client/src/App.tsx`.
- Game logic lives under `server/src/game/` with tests in `server/src/game/__tests__/`.
- Shared Socket.IO client: `client/src/shared/socket.ts` (reuse it; don't create new sockets).

## Commands (run from repo root)
- `npm run dev` — server (:3000) + client (:5173, proxies /socket.io + /api).
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` — must ALL stay green before committing.
- `npm start` — production: server serves `client/dist` on a single port.

## Rules
- **Votes are secret**: never send individual votes to host/other players — only aggregate counts.
- **Timers** are computed server-side (expiry timestamp) and broadcast; clients only render countdowns.
- Avoid `any` (lint error). Prefix intentionally-unused vars/args with `_`.
- Keep server (CJS) and client (ESM) module systems separate.

## Autonomous build
Stories in `prd.json`; learnings in `progress.txt` (read `## Codebase Patterns` first).
Loop: `./ralph.sh --tool claude`.
