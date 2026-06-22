# Design — Audit tecnico → portare SCHIERATI a 9/10

**Data:** 2026-06-22 · **Branch:** `ralph/skeleton-dilemma` · **Voto di partenza:** 7.0/10

## Contesto

Audit tecnico completo del 2026-06-22. Stato di partenza: tutti i gate verdi
(typecheck, lint, 333 test, build). Il progetto è solido — architettura
server-authoritative coerente, voti segreti ben isolati, SQL parametrizzato,
reconnection robusta, codice autodocumentato. Le lacune che impediscono il 9/10
sono **sistemiche**, non "sporco":

- Client quasi privo di test (1 file / 6 test contro 28 componenti).
- Layer socket (`server/src/index.ts`, ~840 righe) senza test d'integrazione.
- Nessuna CI: i gate girano solo a mano.
- God-file: `RoomStore` (2271 righe, 87 metodi), `PlayerApp.tsx` (1789 righe).
- Gap di robustezza puntuali: nickname senza cap, nessun ErrorBoundary,
  nessun rate-limit su create/join.
- Rifiniture: bundle unico 395KB, `npm audit` (5 vuln devDeps), CORS `*`,
  health-check statico, nessuna soglia di coverage.

## Principio di sequenza

**Prima l'automazione e la rete di sicurezza, poi il refactor rischioso, infine
la rifinitura.** Non si rifattorizza una god-class da 87 metodi senza prima avere
test d'integrazione che la coprano. Ogni fase mantiene i gate verdi ed è
indipendentemente committabile + pushabile.

## Fasi

### Fase 0 — CI (fondamenta automazione)
GitHub Actions workflow `ci.yml`: su ogni push/PR esegue
`npm ci → typecheck → lint → test → build`. Node 20. Cache npm.
**Obiettivo:** ogni step successivo è verificato automaticamente.
**Verifica:** workflow presente e validato localmente (`act` non richiesto —
si valida che i comandi del job siano quelli del package.json e passino).

### Fase 1 — Robustezza quick-win (TDD)
- **Cap nickname**: nuova costante `NICKNAME_MAX` (24) in `rooms.ts`; `join()`
  tronca/rifiuta oltre il limite. Test: nickname lungo viene capato, non rifiutato
  bruscamente (UX), e l'aggregato broadcastato resta limitato.
- **Rate-limit create/join**: throttle per-socket su `player:createRoom` e
  `player:join` (finestra minima fra due tentativi). Test sulla logica di throttle.
- **ErrorBoundary React**: componente che cattura le eccezioni di rendering e
  mostra un fallback "Qualcosa è andato storto — ricarica"; wrappa le viste in
  `App.tsx`. Test con un componente che lancia.

### Fase 2 — Toolchain & perf
- **`npm audit`**: bump di `vitest`/`vite`/`vite-node` alle versioni senza le 5
  vulnerabilità (devDeps). Gate verdi dopo il bump.
- **Code-splitting**: `React.lazy` + `Suspense` per rotta in `App.tsx`
  (host / player / landing / profile) così il telefono non scarica il codice
  dell'host/landing. Verifica: build produce più chunk; player chunk < bundle attuale.

### Fase 3 — Rete di test (prerequisito del refactor)
- **Setup client di test**: `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`;
  `vitest.config.ts` con `environment: 'jsdom'` per i test `.tsx` (mantenendo node
  per i test server). Mock del socket condiviso.
- **Test rendering `PlayerApp` per fase**: per ogni fase chiave (LOBBY, VOTE_1,
  SPLIT_REVEAL, DEFENSE, PREDICT, FINAL_AWARDS) il componente monta la schermata
  attesa dato un `game:state`.
- **Test integrazione socket**: server in-process + `socket.io-client`; scenario
  end-to-end join → vote → split → defense → reconnect (token), asserendo che solo
  gli aggregati lasciano il server (regola voti segreti).

### Fase 4 — Refactor god-file (protetto dai test 1-3)
- **`RoomStore` per dominio**: estrarre moduli coesi (voto, difese/interventi,
  percorso, squadre, predizioni/scommesse, awards) mantenendo l'API pubblica
  usata da `index.ts`. I 327 test esistenti + i nuovi d'integrazione fanno da rete.
- **`PlayerApp` per fase**: estrarre un sotto-componente per fase (es.
  `LobbyView`, `VoteView`, `DefenseView`…), riducendo `PlayerApp` a un router di
  fase. I test di rendering della Fase 3 fanno da rete.

### Fase 5 — Rifinitura
- **Soglie coverage** in `vitest.config.ts` (provider `v8`, soglie ragionevoli
  sul codice di gioco, non bloccanti sul client legacy).
- **CORS ristretto**: Socket.IO `origin` dall'env (`CLIENT_ORIGIN`) in prod,
  `*` solo in dev.
- **Health-check sul DB**: `/api/health` verifica la connessione (quando il DB è
  abilitato) e ritorna `db: ok|down`.

## Strategia di test
TDD dove c'è logica (cap nickname, rate-limit, ErrorBoundary, integrazione socket,
refactor). Per CI/coverage/CORS la verifica è l'esecuzione dei gate. Ogni fase
chiude con: gate verdi → commit → `git push`.

## Cadenza & checkpoint
Una fase alla volta, con checkpoint all'utente a ogni stacco. Ogni fase è un
ciclo `writing-plans` → TDD → verifica → commit → push. La Fase 4 (refactor) parte
solo dopo che le Fasi 1-3 hanno consolidato la rete di test.

## Non in scope (YAGNI)
- Riscrittura del modello di stato (resta in memoria + snapshot).
- Migrazione a un nuovo framework client/server.
- Feature di gioco nuove.
- Observability completa (metriche/tracing) — fuori dal target 9/10 per un
  party-game; ci si ferma a logging strutturato se serve.
