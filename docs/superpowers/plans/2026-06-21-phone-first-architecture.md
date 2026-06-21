# Phone-first architecture (Lotto 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La partita funziona **solo con i telefoni**: chi crea la stanza dal telefono è un giocatore-leader con i controlli; ogni telefono mostra i contenuti pubblici (dilemma, split, difese, risultati, premi). La TV (`/host`) diventa una vista spettatore opzionale agganciata via codice.

**Architecture:** Il server diventa "leader-per-`playerId`" invece di "host-per-socket". Un nuovo evento `player:createRoom` crea la stanza e iscrive il creatore come leader; i controlli `host:*` diventano `leader:*` gated dal `leaderId`; `spectator:join` aggancia la TV in sola lettura. Le viste pubbliche oggi solo su `/host` vengono estratte in componenti condivisi e renderizzate anche sul telefono.

**Tech Stack:** TypeScript (server CJS + client ESM), Socket.IO, React Router, Vitest.

## Global Constraints

- **Voti segreti:** solo conteggi aggregati lasciano il server (invariato).
- **Timer server-authoritative:** le fasi avanzano già da sole; il leader può solo *saltare* (invariato).
- `leaderId` è il `playerId` stabile (sopravvive ai reconnect). È informazione pubblica (chi guida), non un segreto.
- Niente `any`; prefissa con `_` gli inutilizzati. Server CJS / client ESM separati.
- `npm run typecheck && npm run lint && npm test && npm run build` tutti verdi prima di ogni commit.
- Questo lotto è **indipendente** dagli altri due (spunti, punti ciechi). È però il più ampio: i task client sono refactor/integrazione, verificati con `typecheck`/`lint`/`build` + prova manuale (Vitest copre solo `server/**`).

## File Structure

- Modify `server/src/game/rooms.ts` — `Room.leaderId`; `setLeader`/`isLeader`; riassegnazione leader in `leave`.
- Modify `server/src/index.ts` — `player:createRoom`; gating `leader:*`; `spectator:join`; `leaderId` nel payload; rimozione di `host:*` + `hostRooms`.
- Modify `client/src/shared/events.ts` — nuovi nomi evento, `leaderId` in `GameStatePayload`.
- Modify `client/src/landing/Landing.tsx` — "Crea" porta al flusso di creazione su telefono.
- Create `client/src/shared/ui/PublicViews.tsx` (+ export in `client/src/shared/ui/index.ts`) — `DilemmaCard`, `SplitBar`, `ResultsPanel`, `AwardsPanel` condivisi.
- Modify `client/src/player/PlayerApp.tsx` — form "Crea/Entra", rilevamento leader, controlli leader, rendering pubblico completo.
- Modify `client/src/host/HostApp.tsx` — da creatore a **spettatore** read-only via codice, riusa i componenti condivisi.
- Test: `server/src/game/__tests__/rooms.test.ts`.

---

### Task 1: `leaderId`, helper leader e riassegnazione su `leave` (server)

**Files:**
- Modify: `server/src/game/rooms.ts:124-187` (interface `Room`), `:434-464` (`create`), `:835-842` (`leave`); nuovi metodi vicino a `listPlayers:876`.
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces:
  - `Room.leaderId: string | null`
  - `RoomStore.setLeader(code: string, playerId: string): boolean`
  - `RoomStore.isLeader(code: string, playerId: string): boolean`
  - `leave()` riassegna `leaderId` al primo umano rimasto (o `null`) quando il leader esce.

- [ ] **Step 1: Scrivi i test (falliscono)**

In `server/src/game/__tests__/rooms.test.ts`, aggiungi un nuovo `describe`:

```ts
describe('RoomStore leadership', () => {
  it('setLeader marks a present player as leader; isLeader reflects it', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p0', 'P0');
    expect(store.setLeader(code, 'p0')).toBe(true);
    expect(store.isLeader(code, 'p0')).toBe(true);
    expect(store.isLeader(code, 'p1')).toBe(false);
  });

  it('setLeader fails for an absent player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.setLeader(code, 'ghost')).toBe(false);
  });

  it('reassigns leadership to the next human when the leader leaves', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p0', 'P0');
    store.join(code, 'p1', 'P1');
    store.setLeader(code, 'p0');
    store.leave(code, 'p0');
    expect(store.isLeader(code, 'p1')).toBe(true);
  });

  it('keeps the leader when a non-leader leaves', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p0', 'P0');
    store.join(code, 'p1', 'P1');
    store.setLeader(code, 'p0');
    store.leave(code, 'p1');
    expect(store.isLeader(code, 'p0')).toBe(true);
  });

  it('clears leadership (null) when the last human leaves', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p0', 'P0');
    store.setLeader(code, 'p0');
    store.leave(code, 'p0');
    expect(store.get(code)?.leaderId).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui i test, verifica che falliscono**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leadership"`
Expected: FAIL — `store.setLeader` non è una funzione.

- [ ] **Step 3: Implementa**

In `server/src/game/rooms.ts`, interface `Room` (dopo `code`/`createdAt`) guadagna:

```ts
  /** The leader-player's stable id (drives the game from their phone); null until set. */
  leaderId: string | null;
```

In `create()`, nell'oggetto `room`, aggiungi `leaderId: null,`.

In `leave()`, dopo `const removed = room.players.delete(playerId);` (rinomina l'attuale `return room.players.delete(...)`):

```ts
  leave(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    room.votes.delete(playerId);
    room.votes1.delete(playerId);
    const removed = room.players.delete(playerId);
    if (removed && room.leaderId === playerId) {
      const nextHuman = [...room.players.values()].find((p) => !p.isBot);
      room.leaderId = nextHuman ? nextHuman.id : null;
    }
    return removed;
  }
```

Aggiungi i due metodi (vicino a `listPlayers`):

```ts
  /** Make a present player the room's leader. False if room/player unknown. */
  setLeader(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(playerId)) return false;
    room.leaderId = playerId;
    return true;
  }

  /** Whether the given player is the room's leader. */
  isLeader(code: string, playerId: string): boolean {
    return this.rooms.get(code)?.leaderId === playerId;
  }
```

- [ ] **Step 4: Esegui i test, verifica che passano**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leadership"`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(phone-first): room leaderId + leadership reassignment on leave"
```

---

### Task 2: Nomi evento e tipi condivisi (client/events.ts)

**Files:**
- Modify: `client/src/shared/events.ts:4-35` (`SocketEvents`), `:278-321` (`GameStatePayload`)

**Interfaces:**
- Produces (nomi evento): `PlayerCreateRoom: 'player:createRoom'`, `LeaderStartGame: 'leader:startGame'`, `LeaderAdvancePhase: 'leader:advancePhase'`, `LeaderAddBot: 'leader:addBot'`, `LeaderRemoveBot: 'leader:removeBot'`, `LeaderStartError: 'leader:startError'`, `SpectatorJoin: 'spectator:join'`. `GameStatePayload.leaderId: string | null`.

> Verifica: `typecheck` (i consumatori — index/Player/Host — vengono aggiornati nei task successivi nello stesso ordine).

- [ ] **Step 1: Aggiorna `SocketEvents`**

In `client/src/shared/events.ts`, sostituisci le voci host con quelle nuove:

```ts
  /** A player creates a room from their phone and becomes its leader. */
  PlayerCreateRoom: 'player:createRoom',
  /** A spectator screen (TV) attaches to an existing room, read-only. */
  SpectatorJoin: 'spectator:join',
  /** Leader starts the game, choosing how many dilemmas to play. */
  LeaderStartGame: 'leader:startGame',
  /** Server rejects the start (not enough players, bad count, already started). */
  LeaderStartError: 'leader:startError',
  /** Leader force-advances the state machine, skipping the current countdown. */
  LeaderAdvancePhase: 'leader:advancePhase',
  /** Leader adds a server-driven bot to fill a seat. */
  LeaderAddBot: 'leader:addBot',
  /** Leader removes a bot by id. */
  LeaderRemoveBot: 'leader:removeBot',
```

Rimuovi `HostCreateRoom`, `HostRoomCreated`, `HostStartGame`, `HostStartError`, `HostAdvancePhase`, `HostAddBot`, `HostRemoveBot`. (`RoomCreatedPayload` non serve più: rimuovilo se inutilizzato.)

- [ ] **Step 2: Aggiungi `leaderId` al payload di stato**

In `GameStatePayload`, dopo `mode: GameMode;`:

```ts
  /** The leader-player's id (drives the game); null until a leader exists. */
  leaderId: string | null;
```

- [ ] **Step 3: typecheck (atteso: errori nei consumatori, risolti nei task 3/5/8)**

Run: `npm run typecheck`
Expected: errori SOLO in `index.ts`/`PlayerApp.tsx`/`HostApp.tsx` sui vecchi nomi — verranno corretti nei task seguenti. Non committare finché il typecheck non è verde (fine Task 8).

---

### Task 3: Handler server (createRoom, gating leader, spectator)

**Files:**
- Modify: `server/src/index.ts:25-27` (rimuovi `hostRooms`), `:80-111` (`gameStatePayload`), `:176-333` (handler), `:303-332` (disconnect)

**Interfaces:**
- Consumes: `rooms.create/join/setLeader/isLeader` (Task 1), mappe `sessions`/`tokens`/`playerSocket` (esistenti).
- Produces: handler `player:createRoom`, `leader:*`, `spectator:join`; `leaderId` in `gameStatePayload`.

- [ ] **Step 1: `leaderId` nel payload + helper di gating**

In `server/src/index.ts`, in `gameStatePayload`, aggiungi `leaderId: room.leaderId,` (vicino a `mode: room.mode,`).

Rimuovi la riga `const hostRooms = new Map<string, string>();` e, nel `disconnect`, la riga `hostRooms.delete(socket.id);`.

Aggiungi un helper (vicino a `advanceAndBroadcast`):

```ts
// The room a socket may control: only if its player is that room's leader.
function leaderCodeFor(socketId: string): string | null {
  const session = sessions.get(socketId);
  if (!session) return null;
  return rooms.isLeader(session.code, session.playerId) ? session.code : null;
}
```

- [ ] **Step 2: Handler `player:createRoom` + `spectator:join`**

Sostituisci l'handler `host:createRoom` con:

```ts
  // A player creates a room from their phone: they join as a player AND become
  // the room's leader (the controls live on their phone; the TV is optional).
  socket.on('player:createRoom', (payload: { nickname?: string }) => {
    const nickname = String(payload?.nickname ?? '');
    const { code } = rooms.create();
    const playerId = `p_${randomUUID()}`;
    const token = randomUUID();
    const result = rooms.join(code, playerId, nickname);
    if (!result.ok) {
      socket.emit('player:joinError', { error: result.error });
      return;
    }
    rooms.setLeader(code, playerId);
    tokens.set(token, { code, playerId });
    sessions.set(socket.id, { code, playerId });
    playerSocket.set(playerId, socket.id);
    socket.join(code);
    socket.emit('player:joined', { code, player: result.player, token });
    broadcastLobby(code);
    broadcastGameState(code); // carries leaderId so the creator sees their controls
  });

  // A spectator screen (TV) attaches to an existing room in read-only mode.
  socket.on('spectator:join', (payload: { code?: string }) => {
    const code = String(payload?.code ?? '').trim().toUpperCase();
    if (!rooms.has(code)) {
      socket.emit('player:joinError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    socket.join(code);
    socket.emit('lobby:update', { players: rooms.listPlayers(code) });
    const room = rooms.get(code);
    if (room) socket.emit('game:state', gameStatePayload(room));
  });
```

- [ ] **Step 3: Controlli `leader:*` gated**

Sostituisci gli handler `host:startGame` / `host:advancePhase` / `host:addBot` / `host:removeBot` con:

```ts
  socket.on('leader:startGame', (payload: { dilemmaCount?: number; register?: string; mode?: string }) => {
    const code = leaderCodeFor(socket.id);
    if (!code) {
      socket.emit('leader:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    const result = rooms.startGame(
      code,
      Number(payload?.dilemmaCount),
      String(payload?.register ?? 'misto'),
      String(payload?.mode ?? 'gruppo'),
    );
    if (!result.ok) {
      socket.emit('leader:startError', { error: result.error });
      return;
    }
    broadcastGameState(code);
    schedulePhase(code);
  });

  socket.on('leader:advancePhase', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    advanceAndBroadcast(code);
  });

  socket.on('leader:addBot', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (rooms.addBot(code).ok) broadcastLobby(code);
  });

  socket.on('leader:removeBot', (payload: { id?: string }) => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (rooms.removeBot(code, String(payload?.id ?? ''))) broadcastLobby(code);
  });
```

- [ ] **Step 4: typecheck server**

Run: `npm run typecheck --workspace server`
Expected: verde (server pulito; i consumatori client restano da aggiornare).

> Non committare ancora: il client non compila finché i task 4/5/8 non sono fatti. (In esecuzione subagent, raggruppa Task 3–8 in un unico ciclo di review oppure committa con `--no-verify` solo se il progetto non ha hook di pre-commit; preferibile: completa fino a Task 8 e committa una volta verde.)

---

### Task 4: Landing — "Crea" porta al flusso di creazione su telefono

**Files:**
- Modify: `client/src/landing/Landing.tsx:13-17`

- [ ] **Step 1: Reindirizza "Crea" al telefono**

In `client/src/landing/Landing.tsx`:

```ts
  const create = () => navigate('/join?create=1');
  const join = () => navigate('/join');
```

(`/host` resta raggiungibile per chi vuole la TV: lo si apre direttamente o da un link "Proietta su TV" — vedi Task 8. Aggiorna il commento in cima al file di conseguenza.)

---

### Task 5: PlayerApp — creazione stanza + rilevamento leader

**Files:**
- Modify: `client/src/player/PlayerApp.tsx:76-206` (stato, effetti, handler), form di join (`:527-592`)

**Interfaces:**
- Consumes: `SocketEvents.PlayerCreateRoom`, `GameStatePayload.leaderId` (Task 2).
- Produces: stato `isLeader` (derivato da `game.leaderId === playerId`); funzione `createRoom()`.

- [ ] **Step 1: Modalità "crea" e funzione di creazione**

In `PlayerApp`:
- leggi l'intento dall'URL: `function urlWantsCreate(): boolean { return new URLSearchParams(window.location.search).get('create') === '1'; }`
- stato: `const [mode, setMode] = useState<'join' | 'create'>(() => (urlWantsCreate() ? 'create' : 'join'));`
- funzione:

```ts
const createRoom = (e: FormEvent) => {
  e.preventDefault();
  const nick = nickname.trim();
  if (!nick) { setError(JOIN_ERROR_MESSAGES.NICKNAME_REQUIRED); return; }
  setError(null);
  setSubmitting(true);
  getSocket().emit(SocketEvents.PlayerCreateRoom, { nickname: nick });
};
```

- [ ] **Step 2: Form crea/entra**

Nel form finale (quando non si è ancora in una stanza), quando `mode === 'create'` mostra solo il campo nickname e un bottone "Crea stanza" (chiama `createRoom`); quando `mode === 'join'` mostra codice + nickname e "Entra" (il `handleSubmit` esistente). Aggiungi un link per alternare: "Hai un codice? Entra" / "Vuoi creare una stanza?". `onJoined` (esistente) gestisce già sia create che join (entrambi emettono `player:joined`).

- [ ] **Step 3: Rilevamento leader**

Aggiungi: `const isLeader = game?.leaderId != null && game.leaderId === playerId;`
(Sarà usato nel Task 7 per mostrare i controlli.)

- [ ] **Step 4: typecheck client**

Run: `npm run typecheck --workspace client`
Expected: errori residui solo dove i task 7/8 devono ancora intervenire (controlli leader, HostApp). Procedi.

---

### Task 6: Estrai i componenti pubblici condivisi

**Files:**
- Create: `client/src/shared/ui/PublicViews.tsx`
- Modify: `client/src/shared/ui/index.ts` (ri-esporta i nuovi componenti)

**Interfaces:**
- Produces (componenti puri di presentazione, props tipizzate da `events.ts`):
  - `DilemmaCard({ dilemma }: { dilemma: PublicDilemma })`
  - `SplitBar({ split }: { split: VoteSplit })`
  - `ResultsPanel({ swing }: { swing: PublicSwing })`
  - `AwardsPanel({ awards }: { awards: Award[] })`

- [ ] **Step 1: Crea i componenti**

Crea `client/src/shared/ui/PublicViews.tsx` con i quattro componenti. Sposta dentro `ResultsPanel`/`AwardsPanel`/`SplitBar`/`DilemmaCard` il markup oggi presente nei rami di `HostApp.tsx` (`phase === 'SPLIT_REVEAL' && split`, `phase === 'PHASE_RESULTS' && swing`, `phase === 'FINAL_AWARDS'`, e la card dilemma usata in VOTE_*), parametrizzandolo dalle props invece che da `game`. Esempio per `SplitBar` (adatta gli altri allo stesso modo, riusando `Card`/`Pill` da `./index`):

```tsx
import type { PublicDilemma, VoteSplit, PublicSwing, Award } from '../events';
import { Card } from './index';

export function SplitBar({ split }: { split: VoteSplit }) {
  const total = split.A + split.B || 1;
  const pctA = Math.round((split.A / total) * 100);
  return (
    <div style={{ width: 'min(92vw, 40rem)' }}>
      <div style={{ display: 'flex', height: '2.5rem', borderRadius: '0.6rem', overflow: 'hidden' }}>
        <div style={{ width: `${pctA}%`, background: 'rgba(79,140,255,0.6)' }} />
        <div style={{ width: `${100 - pctA}%`, background: 'rgba(255,140,79,0.6)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontWeight: 700 }}>
        <span>A · {split.A}</span>
        <span>{split.B} · B</span>
      </div>
    </div>
  );
}

export function DilemmaCard({ dilemma }: { dilemma: PublicDilemma }) {
  return (
    <Card glow="accent" style={{ width: 'min(92vw, 40rem)' }}>
      <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.6rem' }}>{dilemma.text}</p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span><strong>A</strong> · {dilemma.optionA}</span>
        <span><strong>B</strong> · {dilemma.optionB}</span>
      </div>
    </Card>
  );
}

export function ResultsPanel({ swing }: { swing: PublicSwing }) {
  // Move HostApp's PHASE_RESULTS markup here, reading from `swing`
  // (swing.switched, swing.attribution[].defender.nickname/votes).
  return (/* ...adattato dal ramo PHASE_RESULTS di HostApp... */ null);
}

export function AwardsPanel({ awards }: { awards: Award[] }) {
  // Move HostApp's FINAL_AWARDS markup here, reading from `awards`
  // (each award.emoji/title/description/winner.nickname).
  return (/* ...adattato dal ramo FINAL_AWARDS di HostApp... */ null);
}
```

(Completa `ResultsPanel`/`AwardsPanel` spostando il markup reale dai rispettivi rami di HostApp — non lasciarli `null`.)

- [ ] **Step 2: Ri-esporta**

In `client/src/shared/ui/index.ts` aggiungi:

```ts
export { DilemmaCard, SplitBar, ResultsPanel, AwardsPanel } from './PublicViews';
```

- [ ] **Step 3: typecheck client**

Run: `npm run typecheck --workspace client`
Expected: i nuovi componenti compilano (i consumatori HostApp/PlayerApp si aggiornano nei task 7/8).

---

### Task 7: PlayerApp — rendering pubblico completo + controlli leader

**Files:**
- Modify: `client/src/player/PlayerApp.tsx` (rami di fase + lobby)

**Interfaces:**
- Consumes: `DilemmaCard`/`SplitBar`/`ResultsPanel`/`AwardsPanel` (Task 6); `isLeader` (Task 5); eventi `LeaderStartGame`/`LeaderAdvancePhase`/`LeaderAddBot`/`LeaderRemoveBot`.

- [ ] **Step 1: Controlli leader nella lobby**

Quando `joinedCode && phase === 'LOBBY' && isLeader`, mostra (sotto la roster) i controlli di configurazione + avvio, riusando la logica di HostApp: scelta formato/registro/modalità, `Aggiungi bot`/`Rimuovi bot`, e `Avvia partita`. Gli emit usano i nuovi nomi:

```ts
const startGame = () => getSocket().emit(SocketEvents.LeaderStartGame, { dilemmaCount: FORMAT_DILEMMA_COUNT[format], register, mode: gameMode });
const addBot = () => getSocket().emit(SocketEvents.LeaderAddBot);
const removeBot = (id: string) => getSocket().emit(SocketEvents.LeaderRemoveBot, { id });
const advance = () => getSocket().emit(SocketEvents.LeaderAdvancePhase);
```

Aggiungi un listener `LeaderStartError` (riusa `START_ERROR_MESSAGES`). I non-leader vedono il testo «In attesa che il leader avvii la partita…» (sostituisci «host» con «leader»).

- [ ] **Step 2: Pulsante "salta fase" per il leader in gioco**

Quando `isLeader` e la fase ha un timer (cioè non LOBBY/FINAL_AWARDS/FINAL_DUEL), mostra un piccolo bottone «Salta ▶» che chiama `advance()`.

- [ ] **Step 3: Rendi i contenuti pubblici sul telefono**

Sostituisci i rami "Guarda lo schermo condiviso" con contenuto reale:
- `SPLIT_REVEAL`: `{game?.split && <SplitBar split={game.split} />}` + la `DilemmaCard`.
- `PHASE_RESULTS`: `{game?.swing && <ResultsPanel swing={game.swing} />}` (oltre alla riga "N hanno cambiato idea" già presente).
- `FINAL_AWARDS`: `{game?.awards && <AwardsPanel awards={game.awards} />}` (la card privata "punto cieco" è del Lotto 3, indipendente).
- `DILEMMA_REVEAL`: mostra la `DilemmaCard`.

- [ ] **Step 4: typecheck / lint / build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: verde (richiede anche Task 8 fatto per HostApp).

---

### Task 8: HostApp → spettatore read-only via codice

**Files:**
- Modify: `client/src/host/HostApp.tsx` (bootstrap connessione + render)

**Interfaces:**
- Consumes: `SocketEvents.SpectatorJoin`, `DilemmaCard`/`SplitBar`/`ResultsPanel`/`AwardsPanel` (Task 6).

- [ ] **Step 1: Aggancio spettatore via codice**

Sostituisci il bootstrap di HostApp: invece di `socket.emit(HostCreateRoom)`, leggi un codice da `/host?code=XXXX` (o da un input se assente) ed emetti `spectator:join`:

```ts
function urlCode(): string {
  return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '';
}
// se urlCode() è vuoto, mostra un input "Codice stanza" + bottone "Collega TV"
const attach = (c: string) => getSocket().emit(SocketEvents.SpectatorJoin, { code: c.trim().toUpperCase() });
```

Rimuovi da HostApp: creazione stanza, "Gioca anche tu" (join/vote sull'host), la configurazione di avvio e i controlli `host:*` (ora vivono sul telefono leader). Rimuovi i relativi listener (`HostRoomCreated`, `PlayerJoined`, `PlayerVoted`, ecc.) e lo stato non più usato.

- [ ] **Step 2: Render read-only riusando i componenti condivisi**

Mantieni i rami di fase di HostApp come **vista grande passiva**, ma fai sì che SPLIT_REVEAL/PHASE_RESULTS/FINAL_AWARDS usino `SplitBar`/`ResultsPanel`/`AwardsPanel`, e DILEMMA_REVEAL/VOTE_* usino `DilemmaCard`. In LOBBY mostra il codice + roster + «In attesa che il leader avvii…». Nessun bottone di controllo.

- [ ] **Step 3: typecheck / lint / build (tutto verde)**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto verde.

- [ ] **Step 4: Verifica manuale (phone-first, poi TV)**

Run: `npm run dev`.
1. Telefono A: apri `/` → "Crea una partita" → inserisci nickname → "Crea stanza". Vedi il codice e i controlli leader.
2. Telefoni B/C: apri `/join`, inserisci il codice e un nickname.
3. Dal telefono A (leader): scegli formato e avvia. Verifica su OGNI telefono: dilemma, voto, split, difese, risultati e premi (niente più "guarda lo schermo").
4. Opzionale TV: apri `/host`, inserisci il codice → vista grande passiva sincronizzata, senza controlli.
5. Il leader ha "Salta ▶"; i non-leader no. Se il leader esce dalla lobby, la leadership passa a un altro telefono (può avviare).

- [ ] **Step 5: Commit (Task 2–8 insieme)**

```bash
git add client/src/shared/events.ts server/src/index.ts client/src/landing/Landing.tsx \
  client/src/shared/ui/PublicViews.tsx client/src/shared/ui/index.ts \
  client/src/player/PlayerApp.tsx client/src/host/HostApp.tsx
git commit -m "feat(phone-first): leader phone creates/controls; /host becomes optional spectator"
```

---

## Self-Review

- **Spec coverage:** leader-giocatore con controlli (Task 1/3/5/7) ✓; creazione da telefono `player:createRoom` (Task 3) ✓; `leader:*` gated (Task 3) ✓; `spectator:join` per la TV (Task 3/8) ✓; `leaderId` in `game:state` per far emergere i controlli (Task 2/3/5) ✓; rendering pubblico su ogni telefono via componenti condivisi (Task 6/7) ✓; riassegnazione leadership su uscita (Task 1) ✓; `/host` read-only opzionale (Task 8) ✓; Landing "Crea" → flusso telefono (Task 4) ✓.
- **Placeholder scan:** in Task 6 `ResultsPanel`/`AwardsPanel` hanno scheletri da completare spostando markup reale di HostApp — lo Step lo richiede esplicitamente; nessun TODO residuo previsto a fine Task 6.
- **Type consistency:** nomi evento (`PlayerCreateRoom`/`Leader*`/`SpectatorJoin`) definiti in Task 2 e usati identici in index.ts (Task 3), PlayerApp (Task 5/7), HostApp (Task 8); `leaderId: string | null` in `Room` (Task 1), `gameStatePayload` (Task 3) e `GameStatePayload` (Task 2).
- **Ordine/commit:** Task 1 committa da solo (verde). Task 2–8 sono un refactor cliente+server interdipendente: il typecheck è verde solo a fine Task 8, quindi si committano insieme (Task 8 Step 5). In esecuzione subagent, trattare Task 2–8 come un'unica unità di review.
- **Non-goal:** QR per la TV (digita il codice); nessuna nuova regola del Duello (eredita il rendering).
