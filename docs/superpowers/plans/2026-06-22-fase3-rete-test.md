# Fase 3 — Rete di test — Implementation Plan (eseguito)

**Goal:** Costruire la rete di sicurezza (prerequisito del refactor Fase 4): test
d'integrazione del layer socket + test di rendering del god-component PlayerApp.

## Task 1 — Integrazione socket ✅
- Seam di testabilità: `index.ts` esporta `httpServer`; `listen()` guardato da
  `NODE_ENV !== 'test'` (vitest imposta `NODE_ENV=test`), così l'import non apre la porta.
- `server/src/__tests__/integration.test.ts`: server reale su porta effimera +
  `socket.io-client`. Scenari:
  - createRoom → join×2 → startGame → advance×2 → VOTE_1 → tutti votano → SPLIT_REVEAL.
    Asserisce `split === null` durante il voto e `{ A: 2, B: 1 }` solo a SPLIT_REVEAL,
    e che il payload NON contiene voti individuali (invariante voti-segreti).
  - reconnect con token: una socket cade, una nuova rientra col token → stesso `player.id`.
- Copre l'orchestrazione di `index.ts` (840 righe) prima senza alcun test.

## Task 2 — Rendering PlayerApp ✅
- `client/src/player/PlayerApp.test.tsx` (jsdom): fake socket via `vi.hoisted`
  (driver server→client), Clerk mockato. Scenari:
  - schermata di join prima dell'accesso ("Entra nella partita") — smoke che il
    god-component monta senza crash.
  - dopo `player:joined` + `game:state(VOTE_1)` rende le due opzioni del dilemma.
- Pattern riusabile per estendere la copertura delle altre fasi durante il refactor.

## Note
- I test sono esclusi da tsc (come gli altri `.test.*`) ma lintati: niente `any`.
- 343 test totali, gate verdi.
