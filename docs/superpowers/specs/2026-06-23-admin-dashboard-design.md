# Admin dashboard — monitoraggio live + sistema + storico

**Data:** 2026-06-23
**Branch:** ralph/skeleton-dilemma
**Stato:** design approvato, pronto per il piano di implementazione

## Obiettivo

Una pagina admin **di sola lettura** che dà al gestore del gioco una visione
d'insieme in tempo (quasi) reale di:

1. **Stanze/partite live** — stanze attive, modalità, fase, giocatori.
2. **Giocatori connessi** — socket connessi, sessioni attive, riconnessioni in corso.
3. **Salute server/sistema** — uptime, memoria, stato DB, conteggi, config.
4. **Storico & statistiche** — aggregati persistiti su Postgres.

Non è una console di moderazione: **nessuna azione** che modifichi lo stato (chiudere
stanze, espellere, forzare fasi). Le azioni restano una possibile Fase 2 fuori scope.

## Decisioni prese (brainstorming)

- **Cosa monitora:** tutti e quattro gli ambiti sopra.
- **Auth:** Clerk + allowlist di user-id (`ADMIN_USER_IDS`). Nessun nuovo segreto
  condiviso; ogni accesso è attribuibile a un account.
- **Scope azioni:** **solo lettura**.
- **Trasporto dati live:** **REST polling** (~4s), non WebSocket. Sola lettura →
  il polling basta, riusa l'auth REST già in prod, non tocca il layer socket né la
  logica di gioco live.

## Vincoli del progetto da rispettare (NON derogabili)

- **I voti sono segreti.** Nemmeno l'admin vede i voti individuali. Lo snapshot delle
  stanze è sanificato **server-side**: i campi `votes`, `votes1`, `confirmedVote2`,
  `knowGuesses`, `knowTargets`, `infiltratorId`, `accusations`, `predictions`,
  `swingBets` **non lasciano mai il server**. Escono solo conteggi aggregati e dati
  pubblici (nickname, isBot, fase, stato connessione).
- **Server CJS / client ESM** restano separati.
- **No `any`** (errore di lint); prefisso `_` per var/arg intenzionalmente inutilizzati.
- **Timer** calcolati server-side: l'admin riceve `phaseExpiresAt` (timestamp) e
  renderizza il countdown lato client.
- Gate verde obbligatorio prima del commit: `typecheck` · `lint` · `test` · `build`.

## Architettura

```
Browser /admin (React, ESM)
  └─ useAdminPoll  ──fetch ogni ~4s, Bearer token Clerk──▶  Express /api/admin/*
                                                              │ requireAdmin (Clerk + allowlist)
                                                              ├─ /overview  → process + io + getPool + config
                                                              ├─ /rooms     → rooms.adminRoomSummaries() (sanificato)
                                                              ├─ /stats     → query Postgres (game_records, awards)
                                                              └─ /whoami    → { isAdmin }
```

### Unità e responsabilità

| Unità | File | Responsabilità | Dipende da |
|---|---|---|---|
| `requireAdmin` | `server/src/adminAuth.ts` (nuovo) | Middleware: verifica Bearer→userId e appartenenza a `ADMIN_USER_IDS`; `401` senza token valido, `403` se non admin | `verifyClerkToken` (clerk.ts), env |
| `isAdminUser(userId)` | `server/src/adminAuth.ts` | Predicato puro su allowlist (env letta lazy). Testabile in isolamento | env |
| `adminRoomSummaries()` | metodo su `RoomStore` in `server/src/game/rooms.ts` | Mappa `rooms.values()` → `AdminRoomSummary[]` **sanificati** | tipi Room |
| endpoint admin | `server/src/index.ts` | 4 GET sotto `/api/admin/*`, tutti dietro `requireAdmin` | adminAuth, rooms, getPool, io |
| `AdminApp` | `client/src/admin/AdminApp.tsx` (nuovo) | Layout 3 pannelli + gate "Accesso negato" | useAdminPoll, design tokens |
| `useAdminPoll` | `client/src/admin/useAdminPoll.ts` (nuovo) | Polling dei 3 endpoint con token Clerk; loading/error/401-403 | shared auth/token |

> Nota: `index.ts` è già un god-file noto. Il middleware e la logica di allowlist
> vivono in `adminAuth.ts` separato; in `index.ts` si aggiungono solo i wiring degli
> endpoint, coerentemente con la decomposizione già fatta nell'audit 9/10.

## Endpoint backend (tutti `GET`, tutti dietro `requireAdmin`)

### `GET /api/admin/whoami`
Risposta: `{ isAdmin: boolean }`. Non espone dati: serve solo al client per decidere
se mostrare la dashboard o "Accesso negato". (Restituisce `isAdmin:false` invece di 403
così il client distingue "loggato ma non admin" da "non loggato".)

### `GET /api/admin/overview`
```jsonc
{
  "now": 1750000000000,
  "uptimeSec": 3600,
  "memory": { "rssMB": 120, "heapUsedMB": 80 },
  "db": "ok" | "down" | "disabled",
  "counts": {
    "rooms": 3,
    "socketsConnected": 12,   // io.engine.clientsCount
    "sessions": 9,            // sessions.size
    "reconnecting": 1         // graceTimers.size
  },
  "config": {
    "aiDefense": false,       // aiDefenseEnabled()
    "clerk": true,            // chiave Clerk presente
    "dbConfigured": true
  }
}
```
`db` riusa la stessa logica di `/api/health` (`SELECT 1` su `getPool()`).
`sessions`/`graceTimers` vivono in `index.ts`: si passano valori/getter all'handler
(o si calcola inline lì), senza esportare le mappe.

### `GET /api/admin/rooms`
```jsonc
{
  "rooms": [
    {
      "code": "ABCD",
      "format": "classic" | "percorso" | "storia",
      "mode": "gruppo" | "duello",
      "phase": "VOTE_1",
      "dilemmaIndex": 2,
      "dilemmaCount": 5,
      "humanCount": 4,
      "botCount": 1,
      "createdAt": 1750000000000,
      "phaseExpiresAt": 1750000030000,   // o null
      "players": [
        { "nickname": "Anna", "isBot": false, "connected": true },
        { "nickname": "Bot-Roccione", "isBot": true, "connected": true }
      ]
    }
  ]
}
```
**Sanificazione obbligatoria** in `adminRoomSummaries()`: si costruisce esplicitamente
il DTO campo per campo (allowlist di campi), **non** si serializza `Room` per intero.
Nessun voto, guess, target, ruolo infiltrato o accusa nel payload.

Lo stato `connected` per giocatore: derivato da `index.ts` (chi ha un
`graceTimer` attivo è in riconnessione). Se questo richiede dati che vivono in
`index.ts` e non nel `Room`, lo si compone nell'handler dell'endpoint dopo aver
ottenuto i summary dal `RoomStore` (il `RoomStore` resta agnostico ai socket).

### `GET /api/admin/stats`
```jsonc
{
  "enabled": true,            // false se DB disabilitato → pannello "DB non configurato"
  "totals": { "games": 42, "awards": 130, "avgPlayers": 4.8 },
  "byMode": { "gruppo": 30, "duello": 12 },
  "recentGames": [
    { "gameCode": "...", "mode": "gruppo", "playerCount": 5, "rounds": 5, "playedAt": 1750000000000 }
  ]
}
```
Query su `game_records` e `awards`. Se `getPool()` è `null` → `{ "enabled": false }`.

## Client `/admin`

- Nuova rotta in `client/src/App.tsx`: `<Route path="/admin" element={<AdminApp />} />`.
- `AdminApp` chiama `whoami` all'avvio:
  - non loggato o `isAdmin:false` → schermata "Accesso negato" (il backend resta la
    guardia vera; questa è solo UX).
  - admin → tre pannelli, popolati da `useAdminPoll` (polling 4s):
    1. **Sistema** — card: uptime, memoria, stato DB (badge ok/down/disabled),
       conteggi (stanze/socket/sessioni/riconnessioni), config (AI, Clerk, DB).
    2. **Stanze live** — tabella: codice, modalità/format, fase, giocatori
       (umani+bot), aperta da (relativo), countdown da `phaseExpiresAt`.
       Stato vuoto: "Nessuna stanza attiva".
    3. **Storico** — numeri aggregati + lista ultime partite; se `enabled:false`
       mostra "DB non configurato".
- Solo design token esistenti (navy / blu / terracotta / gold). Nessun colore
  off-palette, nessuna libreria nuova. `100dvh`, coerente con l'audit UX.

## Configurazione

- Nuova env **`ADMIN_USER_IDS`** = lista di Clerk user-id separati da virgola.
  Vuota/assente → nessun admin (la dashboard è inaccessibile, fail-safe).
- Da impostare sul servizio Railway `schierati` per la prod.
- Letta **lazy** dentro le funzioni (mai a top-level di modulo), coerentemente con
  la lezione "server: read env lazily".

## Testing

Server (Vitest, `server/src/__tests__/`):
- `adminAuth.test.ts`: `isAdminUser` (in allowlist / fuori / allowlist vuota);
  `requireAdmin` (no token → 401, token valido non-admin → 403, admin → next()).
- `rooms.test.ts` (estensione): `adminRoomSummaries()` produce i campi attesi e
  **non contiene** chiavi `votes`/`votes1`/`knowGuesses`/`infiltratorId`/`accusations`
  (asserzione esplicita anti-leak).
- `integration.test.ts` (estensione): gli endpoint `/api/admin/*` rispondono 401/403
  senza/credenziali errate e con shape corretta da admin (mock di `verifyClerkToken`).

Gate completo verde prima del commit: `npm run typecheck && npm run lint && npm test && npm run build`.

## Out of scope (esplicito)

- Qualsiasi azione di moderazione (chiudere stanze, kick, forzare fase) — Fase 2.
- Push real-time via WebSocket/SSE — il polling basta per sola lettura.
- Grafici storici nel tempo / serie temporali — solo aggregati e ultime N partite.
- Gestione multi-istanza: lo stato live è quello dell'unica istanza Railway.

## Rischi & mitigazioni

- **Leak di voti** → mitigato dalla sanificazione server-side con allowlist di campi
  + test anti-leak dedicato.
- **`index.ts` god-file** → la logica nuova vive in `adminAuth.ts`; in `index.ts` solo
  wiring.
- **Allowlist vuota in prod** → fail-safe (nessun accesso) è il comportamento corretto;
  documentare di impostare `ADMIN_USER_IDS` su Railway.
