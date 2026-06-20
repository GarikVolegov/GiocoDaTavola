# Riconnessione (giocatore + host + stato UI) — design

**Data:** 2026-06-20
**Stato:** approvato (in attesa di review della spec scritta)
**Tipo:** robustezza (server + client). Copre US-015 "Riconnessione base", estesa a host + indicatori di stato.

## Contesto e problema

Oggi l'identità è il `socket.id` (volatile): `Player.id === socket.id`, e l'host
possiede la stanza via `hostRooms: socket.id → code`. Alla minima disconnessione
(telefono che si blocca, perdita wifi, refresh) il socket cambia →
- il **giocatore** viene visto come nuovo → perde posto, voti, `votes1`, stat, `duelScore`;
- l'**host** che fa refresh **crea una stanza nuova** → la partita in corso è persa per tutti.

Per un party-game dal vivo è un problema reale. La soluzione: un **token stabile per
dispositivo** (UUID in `localStorage`) come identità applicativa; i socket restano
effimeri e servono solo per l'instradamento.

## Obiettivo

- Un giocatore che cade e rientra (stesso dispositivo) **ritrova posto + stato** e la
  fase corrente.
- Un host che fa refresh/cade **recupera la stessa stanza e partita**.
- Sullo schermo host i giocatori disconnessi appaiono **offline (in grigio)** e tornano
  attivi al rientro; l'host può **rimuovere** un offline.

## Non-obiettivi (YAGNI)

- Nessun timer di sfratto automatico degli offline.
- Nessun trasferimento di host (un host diverso che prende il controllo).
- Nessuna persistenza su DB (le stanze restano in memoria per la vita del processo).
- Riconnessione cross-device (token nuovo su un altro telefono = nuovo giocatore).

## Architettura

### 1. Identità via token

- **Client:** un helper (`client/src/shared/identity.ts`) genera e memoizza in
  `localStorage` un `playerToken` e un `hostToken` (UUID v4 via `crypto.randomUUID()`).
  Una funzione per ciascuno: `getPlayerToken()`, `getHostToken()`. Distinti perché un
  unico dispositivo può essere host **e** giocatore (host che "Gioca anche tu").
- **Server / `RoomStore`:** `Player.id` diventa il **token** del client (non il
  socket.id). `join(code, token, nickname)` usa il token come chiave: già oggi
  `room.players`, `votes`, `votes1`, `stats`, `duelScore` sono keyed su `Player.id`, quindi
  conservano lo stato attraverso il cambio di socket senza altre modifiche.
- **Routing (index.ts):** mappe a livello server
  - `socketToToken: socketId → playerToken` (per `player:vote`/`disconnect`: dal socket risalgo al token);
  - `playerRooms` resta `socketId → code` (instradamento del socket corrente);
  - `hostTokenRooms: hostToken → code` (persistente) per il recupero stanza host;
  - `hostRooms: socketId → code` resta per i comandi host del socket corrente.

### 2. Stato connesso + offline/online

- `Player` guadagna `connected: boolean` (default `true` al join). `PublicPlayer`
  (events.ts) guadagna `connected: boolean`; `listPlayers` lo espone; `lobby:update`
  lo porta ai client.
- **Disconnect (index.ts):** non si fa più `rooms.leave(...)`. Si risale al token dal
  socket e si marca il giocatore **offline** (`rooms.setConnected(code, token, false)`),
  poi `broadcastLobby`. La stanza e lo stato restano intatti. (La logica di
  early-advance su disconnessione durante un voto va rivista: un offline che "non vota"
  non deve bloccare `allVoted` — vedi §4.)
- **Reconnect giocatore:** `player:join {code, token, nickname}` →
  `rooms.join` ritrova il token esistente, aggiorna nickname, lo rimette **online**;
  index.ts aggiorna `socketToToken`/`playerRooms`, fa `socket.join(code)`, emette
  `player:joined` + **re-invia `lobby:update` e `game:state` a quel socket** (catch-up
  della fase corrente).
- **Reconnect host:** `host:createRoom {hostToken}` → se `hostTokenRooms` ha una stanza
  ancora viva per quel token, rientra (`socket.join`, aggiorna `hostRooms`), e re-invia
  roster + `game:state`; altrimenti crea una stanza nuova e registra il token.
  Metodo testabile sullo store: `recoverHostRoom(token): Room | null` (associazione
  token→code mantenuta dallo store).

### 3. UI

- **Host:** i giocatori con `connected === false` si rendono in grigio con etichetta
  "offline". Il controllo di rimozione (oggi solo per i bot) si estende a **rimuovere un
  umano offline** (`host:removePlayer {token}` → `rooms.removeOfflinePlayer(code, token)`,
  che rifiuta i giocatori online e i bot li gestisce già via `removeBot`).
- **Giocatore/host:** invio del token nei rispettivi eventi; nessun cambiamento di
  flusso visibile in condizioni normali.

### 4. Edge cases

- **allVoted / early-advance:** `allVoted` e l'early-advance contano i **presenti che
  possono votare**. Un offline non vota: `allVoted(code)` deve confrontare i voti con i
  **giocatori online** (`room.votes.size >= onlinePlayers`), così un offline non blocca
  l'avanzamento e un rientro non "sblocca" nulla di inatteso. (Cambio mirato in
  `RoomStore.allVoted`.)
- **Requisiti d'avvio:** i giocatori offline **contano** ancora nel roster (tengono il
  posto). Se bloccano l'avvio (es. 1v1 = esattamente 2), l'host li rimuove.
- **Doppio socket stesso token:** se due socket usano lo stesso token (es. due schede),
  l'ultimo `join`/azione aggiorna `token→socket`; gli eventi vanno al socket più recente.
  Accettabile (è lo stesso "giocatore").
- **Blip di rete:** marcatura offline immediata + online al rientro; un breve lampeggio
  "offline" è accettabile in questa versione (niente debounce).

## Testing

- **Server (TDD, `rooms.test.ts`):**
  - `join` con lo stesso token due volte mantiene un solo posto e conserva voti/stat;
  - dopo `setConnected(false)` lo stato resta; `setConnected(true)` rimette online;
  - `listPlayers` espone `connected`;
  - `allVoted` ignora gli offline (un offline non blocca; rientro coerente);
  - `recoverHostRoom(token)` restituisce la stanza esistente o null;
  - `removeOfflinePlayer` rimuove solo offline (rifiuta online).
- **E2E socket (`.mjs` ad-hoc contro il server prod, poi eliminato):** giocatore vota →
  disconnect → rientro stesso token → posto + `game:state` ri-emesso; refresh host (stesso
  `hostToken`) → recupera la stessa stanza/partita.
- **Client:** nessun test runner → `typecheck`/`lint`/`build` + check manuale.
- **Gate verde** end-to-end: `npm run typecheck && npm run lint && npm test && npm run build`.

## File previsti

- `client/src/shared/identity.ts` — **nuovo**: `getPlayerToken()`, `getHostToken()` (UUID in localStorage).
- `client/src/shared/events.ts` — `token` nei payload di join/createRoom; `PublicPlayer.connected`; nuovo evento `host:removePlayer`.
- `server/src/game/rooms.ts` — `Player.id = token`, `connected`, `setConnected`, `allVoted` online-only, `recoverHostRoom`, `removeOfflinePlayer`.
- `server/src/index.ts` — token nei payload, mappe `socketToToken`/`hostTokenRooms`, disconnect→offline, rejoin re-sync, host recovery, `host:removePlayer`.
- `client/src/player/PlayerApp.tsx` — invia `playerToken` nel join (auto re-join al riconnettersi del socket).
- `client/src/host/HostApp.tsx` — invia `hostToken` (+ `playerToken` per "Gioca anche tu"), render offline, rimozione offline.

## Compatibilità

`Player.id` passa da socket.id a token: cambio interno, ma `Player.id` è già
un'astrazione usata ovunque (gruppo + duello), quindi i sistemi a valle (voti, swing,
difese, scoring duello, premi) non cambiano. I test esistenti che usano id arbitrari
come `'p1'` restano validi (un token è solo una stringa id).
