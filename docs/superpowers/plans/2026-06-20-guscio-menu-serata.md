# Menù della serata (Incremento 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare l'avvio partita in un "menù della serata": l'host sceglie un **registro di contenuto** (Vita / Business pro / Misto) e un **formato** (Assaggio / Classica / Maratona), con un **default a un tocco** (Misto + Classica).

**Architecture:** Estende il flusso esistente `LOBBY → PHASE_INTRO → …` senza aggiungere nuovi stati alla state-machine: la composizione del menù resta nello schermo `LOBBY` dell'host (com'è già oggi), arricchita. Il `register` filtra il deck a inizio partita; il `format` deriva il numero di dilemmi (3/5/7). La sessione-come-sequenza-di-round-eterogenei NON è in scope qui (YAGNI: si introduce con il round-type #2).

**Tech Stack:** Server Node + Socket.IO TypeScript (CommonJS, `tsx` dev / `tsc` build), Vitest. Client React + Vite TypeScript (ESM). Stato in memoria.

## Global Constraints

- **No DB, no account, stato in memoria** — il server è autoritativo.
- **Voti segreti** — solo aggregati lasciano il server (non toccato qui, ma non regredire).
- **Timer autoritativi** server-side (non toccati qui).
- **Niente `any`** (ESLint `no-explicit-any` = error). Prefissare con `_` var/arg intenzionalmente inusati.
- **Server CJS e client ESM separati**: costanti/tipi condivisi sono **duplicati** in `server/src/game/rooms.ts` (+`deck.ts`) e `client/src/shared/events.ts` — tenerli identici, non importare l'uno dall'altro.
- **Quality gate verde prima di ogni commit**, dalla root: `npm run typecheck && npm run lint && npm test && npm run build`.
- Coordinamento: **eseguire con il loop Ralph fermo** e working tree pulito (vedi "Pre-flight").
- Copy in **italiano**, registro informale.

## Pre-flight (una volta, prima della Task 1)

- [ ] Fermare il loop autonomo (`Ctrl-C` nel terminale di `./ralph.sh`) e attendere che la sua iterazione corrente finisca di committare.
- [ ] Confermare base pulita: `git status --short` vuoto; `git log --oneline -1` mostra l'ultima story Ralph committata.
- [ ] Eseguire il quality gate per partire dal verde: `npm run typecheck && npm run lint && npm test && npm run build`.

## File Structure

| File | Responsabilità | Azione |
|---|---|---|
| `server/data/dilemmas.json` | Contenuti, ora taggati per registro | Modify |
| `server/src/game/deck.ts` | `Dilemma` (+`register`), `loadDilemmas`, **`dilemmasForRegister`**, `Deck` | Modify |
| `server/src/game/__tests__/deck.test.ts` | Test filtro registro + minimo contenuti per registro | Modify |
| `server/src/game/rooms.ts` | Registro+guardia, `Room.register`, preset 3/5/7, `startGame(code, dilemmaCount, register)` | Modify |
| `server/src/game/__tests__/rooms.test.ts` | Aggiorna i test `startGame`; aggiunge registro/formato | Modify |
| `client/src/shared/events.ts` | Tipi/costanti/label registro+formato, `StartGamePayload`, errori, `GameStatePayload.register` | Modify |
| `server/src/index.ts` | Handler `host:startGame` legge `{format, register}`; `gameStatePayload` +`register` | Modify |
| `client/src/host/HostApp.tsx` | Pannello "Componi la serata" (registro + preset + default a un tocco) | Modify |

---

### Task 1: Contenuti taggati per registro + filtro nel deck

**Files:**
- Modify: `server/src/game/deck.ts`
- Modify: `server/data/dilemmas.json`
- Test: `server/src/game/__tests__/deck.test.ts`

**Interfaces:**
- Produces:
  - `type ContentRegister = 'vita' | 'business' | 'misto'` (definito qui in `deck.ts` e ri-esportato; in `rooms.ts` sarà duplicato).
  - `interface Dilemma { id: string; text: string; optionA: string; optionB: string; register: 'vita' | 'business' }` (il dato è sempre `vita` o `business`; `misto` è solo un filtro).
  - `function dilemmasForRegister(all: Dilemma[], register: ContentRegister): Dilemma[]` — `misto` → tutti; altrimenti filtra per `register`.

- [ ] **Step 1: Scrivere i test del filtro (falliscono)**

In `server/src/game/__tests__/deck.test.ts` aggiungere (lasciando i test esistenti del `Deck`):

```ts
import { describe, it, expect } from 'vitest';
import { loadDilemmas, dilemmasForRegister } from '../deck';

describe('dilemmasForRegister', () => {
  const all = loadDilemmas();

  it('misto restituisce tutti i dilemmi', () => {
    expect(dilemmasForRegister(all, 'misto')).toHaveLength(all.length);
  });

  it('vita restituisce solo i dilemmi taggati vita', () => {
    const vita = dilemmasForRegister(all, 'vita');
    expect(vita.length).toBeGreaterThan(0);
    expect(vita.every((d) => d.register === 'vita')).toBe(true);
  });

  it('business restituisce solo i dilemmi taggati business', () => {
    const biz = dilemmasForRegister(all, 'business');
    expect(biz.length).toBeGreaterThan(0);
    expect(biz.every((d) => d.register === 'business')).toBe(true);
  });

  it('ogni registro ha abbastanza dilemmi per il formato più lungo (Maratona = 7)', () => {
    expect(dilemmasForRegister(all, 'vita').length).toBeGreaterThanOrEqual(8);
    expect(dilemmasForRegister(all, 'business').length).toBeGreaterThanOrEqual(8);
  });

  it('ogni dilemma è taggato vita o business', () => {
    expect(all.every((d) => d.register === 'vita' || d.register === 'business')).toBe(true);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run server/src/game/__tests__/deck.test.ts`
Expected: FAIL — `dilemmasForRegister` non esiste e `d.register` è `undefined`.

- [ ] **Step 3: Estendere `deck.ts`**

In `server/src/game/deck.ts`: aggiungere il tipo e il campo `register`, esportare `dilemmasForRegister`.

```ts
/** Content register: 'misto' is a filter meaning "any". */
export type ContentRegister = 'vita' | 'business' | 'misto';

export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business';
}

/** Dilemmas matching a register; 'misto' returns the whole pool. */
export function dilemmasForRegister(all: Dilemma[], register: ContentRegister): Dilemma[] {
  if (register === 'misto') return all;
  return all.filter((d) => d.register === register);
}
```

- [ ] **Step 4: Taggare i contenuti in `dilemmas.json`**

Aprire `server/data/dilemmas.json`. Aggiungere a **ogni** oggetto un campo `"register"`:
- `"business"` per dilemmi su azienda/soldi/lavoro/clienti/soci/investimenti (es. d02 soci, d04 dipendente, d06 cliente).
- `"vita"` per dilemmi su scelte personali/relazioni/abitudini/tempo (es. prestito a un amico, sveglia presto, tempo libero).
- Caso ambiguo → scegliere il lato prevalente.

Poi garantire **≥ 8 per registro**. Se uno dei due è sotto 8, aggiungere dal pool pronto qui sotto (già taggato) finché il test al passo 5 è verde:

```json
  { "id": "v90", "text": "Un amico in difficoltà ti chiede un prestito importante.", "optionA": "Glielo faccio: gli amici prima di tutto", "optionB": "No: i soldi rovinano le amicizie", "register": "vita" },
  { "id": "v91", "text": "Svegliarsi alle 5 del mattino è la chiave del successo?", "optionA": "Sì, le ore del mattino valoro doppio", "optionB": "No, conta il riposo non l'orario", "register": "vita" },
  { "id": "v92", "text": "Tra soldi e tempo libero, cosa scegli?", "optionA": "Più soldi: la libertà si compra", "optionB": "Più tempo: non torna indietro", "register": "vita" },
  { "id": "b90", "text": "Le riunioni di lavoro dovrebbero essere abolite?", "optionA": "Quasi tutte: rubano tempo", "optionB": "No: allineano il team", "register": "business" },
  { "id": "b91", "text": "Un socio bravissimo ma sempre in ritardo sui tempi.", "optionA": "Lo tengo: il talento è raro", "optionB": "Lo mando via: l'affidabilità conta di più", "register": "business" },
  { "id": "b92", "text": "Assumere un amico nella tua azienda?", "optionA": "Sì: mi fido ciecamente", "optionB": "No: lavoro e amicizia non si mischiano", "register": "business" }
```

(Nota: la virgola JSON va sistemata a mano in coda all'array.)

- [ ] **Step 5: Verificare che i test passino**

Run: `npx vitest run server/src/game/__tests__/deck.test.ts`
Expected: PASS (tutti, inclusi i test `Deck` preesistenti).

- [ ] **Step 6: Commit**

```bash
git add server/src/game/deck.ts server/data/dilemmas.json server/src/game/__tests__/deck.test.ts
git commit -m "feat: tag dilemmas by register + dilemmasForRegister filter"
```

---

### Task 2: Registro in `startGame` + conteggi preset 3/5/7 (rooms)

**Files:**
- Modify: `server/src/game/rooms.ts`
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `ContentRegister`, `dilemmasForRegister`, `Deck`, `loadDilemmas` da `./deck`.
- Produces:
  - `const DILEMMA_COUNT_OPTIONS = [3, 5, 7] as const` (era `[3, 4, 5]`; ora sono i conteggi prodotti dai preset Assaggio/Classica/Maratona). `type DilemmaCount` + `isDilemmaCount` restano (derivano dalla costante).
  - `const CONTENT_REGISTERS = ['vita', 'business', 'misto'] as const` (mirror del tipo in `deck.ts`) + guardia `isContentRegister`.
  - `Room.register: ContentRegister | null`.
  - `startGame(code: string, dilemmaCount: number, register?: string): StartGameResult` — **stessa forma di prima** con un 3° parametro `register` opzionale (default `'misto'`). NON cambia in firma `(format, …)`: il "formato" è un concetto solo client.
  - `StartGameError` = `'ROOM_NOT_FOUND' | 'NOT_ENOUGH_PLAYERS' | 'INVALID_DILEMMA_COUNT' | 'INVALID_REGISTER' | 'ALREADY_STARTED'` (aggiunge solo `INVALID_REGISTER`).
  - Il costruttore di `RoomStore` cambia il 3° argomento in `makeDeck: (register: ContentRegister) => Deck` (default `(register) => new Deck(dilemmasForRegister(loadDilemmas(), register))`).
- **Ripple minimo sui test esistenti:** `register` ha default `'misto'`, quindi le ~14 chiamate di setup `startGame(code, 3|5)` restano valide e NON vanno toccate. Vanno aggiornati solo: la call `startGame(code, 4)` (4 non è più un preset → `5`) e i test di validazione del count (insieme valido ora `{3,5,7}`; `4` invalido, `2`/`6` restano invalidi).

- [ ] **Step 1: Scrivere/aggiornare i test (falliscono)**

In `server/src/game/__tests__/rooms.test.ts`: AGGIUNGERE il blocco registro qui sotto e AGGIORNARE solo i test di validazione del count per il nuovo insieme `{3,5,7}` (la call setup `startGame(code, 4)` → `5`; `4` ora è invalido). Le altre ~14 call di setup `startGame(code, 3|5)` restano valide (register ha default `'misto'`). Test da avere:

```ts
import { Deck, type Dilemma } from '../deck';

// helper esistente per popolare i player riusato; se non c'è, aggiungerlo:
function addPlayers(store: RoomStore, code: string, n: number) {
  for (let i = 0; i < n; i++) store.join(code, `p${i}`, `P${i}`);
}

describe('startGame con registro', () => {
  it('default register = misto quando non specificato', () => {
    const store = new RoomStore();
    const { code } = store.create();
    addPlayers(store, code, 3);
    const res = store.startGame(code, 5);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.room.phase).toBe('PHASE_INTRO');
      expect(res.room.dilemmaCount).toBe(5);
      expect(res.room.register).toBe('misto');
    }
  });

  it('accetta i conteggi dei preset 3 / 5 / 7', () => {
    for (const n of [3, 5, 7] as const) {
      const store = new RoomStore();
      const { code } = store.create();
      addPlayers(store, code, 3);
      expect(store.startGame(code, n, 'misto').ok).toBe(true);
    }
  });

  it('rifiuta un conteggio non valido (4 non è più un preset)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    addPlayers(store, code, 3);
    expect(store.startGame(code, 4, 'misto')).toEqual({ ok: false, error: 'INVALID_DILEMMA_COUNT' });
  });

  it('rifiuta un registro non valido', () => {
    const store = new RoomStore();
    const { code } = store.create();
    addPlayers(store, code, 3);
    expect(store.startGame(code, 5, 'sport')).toEqual({ ok: false, error: 'INVALID_REGISTER' });
  });

  it('imposta il registro scelto sulla room', () => {
    const store = new RoomStore();
    const { code } = store.create();
    addPlayers(store, code, 3);
    const res = store.startGame(code, 3, 'business');
    expect(res.ok && res.room.register).toBe('business');
  });

  it('costruisce il deck dal registro scelto', () => {
    const onlyVita: Dilemma[] = [
      { id: 'x1', text: 't1', optionA: 'a', optionB: 'b', register: 'vita' },
    ];
    const store = new RoomStore(undefined, undefined, (_register) => new Deck(onlyVita, () => 0));
    const { code } = store.create();
    addPlayers(store, code, 3);
    const res = store.startGame(code, 3, 'vita');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.room.deck?.remainingCount).toBe(1);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: FAIL — `startGame` non accetta ancora `register`, `4` è ancora valido e non esiste `INVALID_REGISTER`.

- [ ] **Step 3: Aggiornare `rooms.ts`**

1. Import: `import { Deck, dilemmasForRegister, loadDilemmas, type Dilemma, type ContentRegister } from './deck';`
2. Cambiare `DILEMMA_COUNT_OPTIONS` da `[3, 4, 5]` a `[3, 5, 7]` (lasciare `DilemmaCount`/`isDilemmaCount` come sono — derivano dalla costante). Aggiungere i registri:

```ts
/** Content registers the host can pick (mirror of deck.ts ContentRegister). */
export const CONTENT_REGISTERS = ['vita', 'business', 'misto'] as const;

function isContentRegister(v: string): v is ContentRegister {
  return (CONTENT_REGISTERS as readonly string[]).includes(v);
}
```

3. `StartGameError` — aggiungere solo `INVALID_REGISTER`:

```ts
export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_DILEMMA_COUNT'
  | 'INVALID_REGISTER'
  | 'ALREADY_STARTED';
```

4. `Room`: aggiungere `register: ContentRegister | null;` (inizializzato `null` in `create()`).
5. Costruttore: cambiare il default di `makeDeck`:

```ts
constructor(
  private readonly genCode: () => string = generateRoomCode,
  private readonly now: () => number = () => Date.now(),
  private readonly makeDeck: (register: ContentRegister) => Deck =
    (register) => new Deck(dilemmasForRegister(loadDilemmas(), register)),
) {}
```

6. `create()`: aggiungere `register: null,` accanto agli altri campi.
7. Aggiornare `startGame` (aggiunge `register`, mantiene il count; ordine di validazione invariato + registro dopo il count):

```ts
startGame(code: string, dilemmaCount: number, register: string = 'misto'): StartGameResult {
  const room = this.rooms.get(code);
  if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
  if (room.phase !== 'LOBBY') return { ok: false, error: 'ALREADY_STARTED' };
  if (!isDilemmaCount(dilemmaCount)) return { ok: false, error: 'INVALID_DILEMMA_COUNT' };
  if (!isContentRegister(register)) return { ok: false, error: 'INVALID_REGISTER' };
  if (room.players.size < MIN_PLAYERS_TO_START) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };

  room.dilemmaCount = dilemmaCount;
  room.register = register;
  room.dilemmaIndex = 0;
  room.phase = 'PHASE_INTRO';
  room.phaseExpiresAt = this.expiryFor('PHASE_INTRO');
  room.deck = this.makeDeck(register);
  room.currentDilemma = null;
  return { ok: true, room };
}
```

- [ ] **Step 4: Verificare che i test passino**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: PASS. Poi `npm test` per l'intera suite — l'unico residuo da aggiornare è la call `startGame(code, 4)` (→ `5`) e i test che asserivano `4` valido. `INVALID_DILEMMA_COUNT` resta (cambia solo l'insieme valido a `{3,5,7}`); le call con `3`/`5` non si toccano.

- [ ] **Step 5: Typecheck server**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat: startGame accepts content register; presets 3/5/7"
```

---

### Task 3: Tipi/costanti condivisi sul client (events.ts)

**Files:**
- Modify: `client/src/shared/events.ts`

**Interfaces:**
- Produces (lato client):
  - `SESSION_FORMATS`, `type SessionFormat`, `FORMAT_DILEMMA_COUNT` (mappa formato→count, **solo client**).
  - `CONTENT_REGISTERS`, `type ContentRegister` (mirror dei valori server).
  - `FORMAT_LABELS: Record<SessionFormat, { nome: string; durata: string; round: number }>`.
  - `REGISTER_LABELS: Record<ContentRegister, string>`.
  - `StartGamePayload = { dilemmaCount: number; register: ContentRegister }` (aggiunge `register`; il client invia il count derivato dal formato).
  - `StartGameError` aggiornato (aggiunge `INVALID_REGISTER`) + `START_ERROR_MESSAGES`.
  - `GameStatePayload.register: ContentRegister | null`.
  - Rimuovere `DILEMMA_COUNT_OPTIONS`/`DilemmaCount` dal client (l'host ora usa i formati).

- [ ] **Step 1: Aggiornare `events.ts`**

Rimuovere `DILEMMA_COUNT_OPTIONS`/`DilemmaCount`. Aggiungere:

```ts
/** Session formats and their dilemma counts (mirror server rooms.ts). */
export const SESSION_FORMATS = ['assaggio', 'classica', 'maratona'] as const;
export type SessionFormat = (typeof SESSION_FORMATS)[number];
export const FORMAT_DILEMMA_COUNT: Record<SessionFormat, number> = {
  assaggio: 3,
  classica: 5,
  maratona: 7,
};

/** Content registers (mirror server deck.ts / rooms.ts). */
export const CONTENT_REGISTERS = ['vita', 'business', 'misto'] as const;
export type ContentRegister = (typeof CONTENT_REGISTERS)[number];

/** Host-facing labels for the menu presets. */
export const FORMAT_LABELS: Record<SessionFormat, { nome: string; durata: string; round: number }> = {
  assaggio: { nome: 'Assaggio', durata: '~15 min', round: 3 },
  classica: { nome: 'Classica', durata: '~30 min', round: 5 },
  maratona: { nome: 'Maratona', durata: '~45 min', round: 7 },
};

export const REGISTER_LABELS: Record<ContentRegister, string> = {
  vita: 'Vita',
  business: 'Business pro',
  misto: 'Misto',
};
```

Aggiornare `StartGamePayload` (il client invia il count derivato dal formato):

```ts
export interface StartGamePayload {
  dilemmaCount: number;
  register: ContentRegister;
}
```

Aggiornare `StartGameError` + messaggi (aggiunge solo `INVALID_REGISTER`):

```ts
export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_DILEMMA_COUNT'
  | 'INVALID_REGISTER'
  | 'ALREADY_STARTED';

export const START_ERROR_MESSAGES: Record<StartGameError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_ENOUGH_PLAYERS: 'Servono almeno 3 giocatori',
  INVALID_DILEMMA_COUNT: 'Numero di dilemmi non valido',
  INVALID_REGISTER: 'Registro non valido',
  ALREADY_STARTED: 'La partita è già iniziata',
};
```

Aggiungere `register` a `GameStatePayload` (dopo `dilemmaCount`):

```ts
  /** Content register chosen at start; null in the lobby. */
  register: ContentRegister | null;
```

- [ ] **Step 2: Typecheck (atteso rosso sul client finché Task 4-5 non aggiornano i consumer)**

Run: `npm run typecheck`
Expected: errori SOLO in `HostApp.tsx` (usa `DILEMMA_COUNT_OPTIONS` e invia `dilemmaCount`) — verranno risolti nella Task 5. Annotare gli errori; non è un commit verde a sé.

> Nota: questa task non committa da sola perché lascia il typecheck rosso. Procedere a Task 4 e 5; il commit verde avviene a fine Task 5. (In esecuzione subagent, trattare Task 3+4+5 come un unico gate di review.)

---

### Task 4: Handler server `host:startGame` + register nel payload

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `RoomStore.startGame(code, dilemmaCount, register)`; `Room.register`.

- [ ] **Step 1: Aggiornare `gameStatePayload`**

Aggiungere `register` (dopo `dilemmaCount`):

```ts
    dilemmaCount: room.dilemmaCount,
    register: room.register,
```

- [ ] **Step 2: Aggiornare l'handler `host:startGame`**

```ts
  socket.on('host:startGame', (payload: { dilemmaCount?: number; register?: string }) => {
    const code = hostRooms.get(socket.id);
    if (!code) {
      socket.emit('host:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    const result = rooms.startGame(
      code,
      Number(payload?.dilemmaCount),
      String(payload?.register ?? 'misto'),
    );
    if (!result.ok) {
      socket.emit('host:startError', { error: result.error });
      return;
    }
    broadcastGameState(code);
    schedulePhase(code);
  });
```

- [ ] **Step 3: Typecheck server**

Run: `npm run typecheck`
Expected: lato server PASS (gli errori restanti sono solo in `HostApp.tsx`, Task 5).

---

### Task 5: Host — pannello "Componi la serata"

**Files:**
- Modify: `client/src/host/HostApp.tsx`

**Interfaces:**
- Consumes: `SESSION_FORMATS`, `FORMAT_LABELS`, `FORMAT_DILEMMA_COUNT`, `CONTENT_REGISTERS`, `REGISTER_LABELS`, `SessionFormat`, `ContentRegister`, `StartGamePayload`.

- [ ] **Step 1: Aggiornare import e stato**

In `client/src/host/HostApp.tsx`:
- Negli import da `'../shared/events'`: rimuovere `DILEMMA_COUNT_OPTIONS`; aggiungere `SESSION_FORMATS, FORMAT_LABELS, FORMAT_DILEMMA_COUNT, CONTENT_REGISTERS, REGISTER_LABELS, type SessionFormat, type ContentRegister`.
- Sostituire lo stato `chosenCount`:

```tsx
  const [format, setFormat] = useState<SessionFormat>('classica');
  const [register, setRegister] = useState<ContentRegister>('misto');
```

- Aggiornare `startGame`:

```tsx
  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.HostStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
    });
  };
```

- [ ] **Step 2: Sostituire il blocco selettore "Quanti dilemmi?"**

Sostituire l'intera `<section>` che contiene "Quanti dilemmi?" + i bottoni `DILEMMA_COUNT_OPTIONS` + "Inizia la partita" con:

```tsx
          <section style={{ width: 'min(90vw, 36rem)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Componi la serata</h2>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Argomenti</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }} role="group" aria-label="Registro">
                {CONTENT_REGISTERS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegister(r)}
                    aria-pressed={register === r}
                    style={{
                      flex: '1 1 0',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      borderRadius: '0.6rem',
                      cursor: 'pointer',
                      border: register === r ? '2px solid #4f8cff' : '2px solid transparent',
                      background: register === r ? 'rgba(79,140,255,0.22)' : 'rgba(127,127,127,0.18)',
                    }}
                  >
                    {REGISTER_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }} role="group" aria-label="Formato">
                {SESSION_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                    style={{
                      flex: '1 1 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      borderRadius: '0.6rem',
                      cursor: 'pointer',
                      border: format === f ? '2px solid #4f8cff' : '2px solid transparent',
                      background: format === f ? 'rgba(79,140,255,0.22)' : 'rgba(127,127,127,0.18)',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>{FORMAT_LABELS[f].nome}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {FORMAT_LABELS[f].round} round · {FORMAT_LABELS[f].durata}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={startGame}
              disabled={!canStart}
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                padding: '0.7rem 2.5rem',
                borderRadius: '0.7rem',
                cursor: canStart ? 'pointer' : 'not-allowed',
                opacity: canStart ? 1 : 0.5,
              }}
            >
              Inizia la partita
            </button>
            {!canStart && (
              <p style={{ opacity: 0.6, margin: 0 }}>
                Servono almeno {MIN_PLAYERS_TO_START} giocatori per iniziare.
              </p>
            )}
            {startError && (
              <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
                {startError}
              </p>
            )}
          </section>
```

(Defaults `register='misto'`, `format='classica'` ⇒ premere "Inizia" senza toccare nulla = avvio Misto + Classica: **default a un tocco**.)

- [ ] **Step 3: Quality gate completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto PASS (client e server allineati).

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/events.ts server/src/index.ts client/src/host/HostApp.tsx
git commit -m "feat: host 'Componi la serata' menu (registro + formato, default a un tocco)"
```

---

### Task 6: Verifica d'integrazione end-to-end (socket)

**Files:**
- Create (temporaneo): `verify-menu.mjs` (cancellato a fine task)

**Interfaces:**
- Consumes: il server di produzione buildato; eventi `host:createRoom`, `player:join`, `host:startGame`, `game:state`, `host:startError`.

- [ ] **Step 1: Script di verifica**

Creare `verify-menu.mjs` nella root:

```js
import { io } from 'socket.io-client';
const URL = `http://localhost:${process.env.PORT || 3990}`;

const wait = (s, ev) => new Promise((res) => s.once(ev, res));
const mkPlayer = async (code, nick) => {
  const s = io(URL, { transports: ['websocket'] });
  await wait(s, 'connect');
  s.emit('player:join', { code, nickname: nick });
  await wait(s, 'player:joined');
  return s;
};

const host = io(URL, { transports: ['websocket'] });
await wait(host, 'connect');
host.emit('host:createRoom');
const { code } = await wait(host, 'host:roomCreated');

await mkPlayer(code, 'A');
await mkPlayer(code, 'B');
await mkPlayer(code, 'C');

// Avvio con menù: Maratona (count 7) + Business
host.emit('host:startGame', { dilemmaCount: 7, register: 'business' });
const state = await wait(host, 'game:state');
console.assert(state.phase === 'PHASE_INTRO', 'phase PHASE_INTRO');
console.assert(state.dilemmaCount === 7, 'maratona => 7 dilemmi, got ' + state.dilemmaCount);
console.assert(state.register === 'business', 'register business, got ' + state.register);

// Registro non valido => errore
const host2 = io(URL, { transports: ['websocket'] });
await wait(host2, 'connect');
host2.emit('host:createRoom');
const r2 = await wait(host2, 'host:roomCreated');
await mkPlayer(r2.code, 'X');
await mkPlayer(r2.code, 'Y');
await mkPlayer(r2.code, 'Z');
host2.emit('host:startGame', { dilemmaCount: 5, register: 'sport' });
const err = await wait(host2, 'host:startError');
console.assert(err.error === 'INVALID_REGISTER', 'INVALID_REGISTER, got ' + err.error);

console.log('OK: menù serata verificato (count=7, register=business, registro non valido respinto)');
process.exit(0);
```

- [ ] **Step 2: Build + run del server prod + script**

Run:
```bash
npm run build
PORT=3990 node server/dist/index.js &
sleep 1
node verify-menu.mjs
kill %1
```
Expected: stampa `OK: menù serata verificato …`, nessun `Assertion failed`.

- [ ] **Step 3: Pulizia + commit**

```bash
rm verify-menu.mjs
git add -A
git commit -m "test: verifica e2e menù serata (formato+registro su socket)" --allow-empty
```

---

## Self-Review (eseguito su questo piano)

**1. Spec coverage** (riferito a `2026-06-20-dibattiti-visione-completa-design.md`, Incremento 2):
- Registri Vita/Business pro/Misto → Task 1–5. ✓
- Preset Assaggio/Classica/Maratona + default a un tocco → Task 2/3/5. ✓
- Schermata "Componi la serata" → Task 5. ✓
- *Fase `SETUP` formale* e *sessione = sequenza di round eterogenei* → **deliberatamente fuori scope** (YAGNI, §13 dello spec): la composizione resta in `LOBBY`; il motore di sessione si introduce con il round-type #2. Documentato in "Architecture".
- *Attesa simpatica / warm-up sui telefoni* → **rimandato** (richiede broadcast di un prompt di riscaldamento; nessun valore bloccante per questo incremento).

**2. Placeholder scan:** nessun "TBD/TODO"; ogni step ha codice/comando concreto. Il tagging di `dilemmas.json` è guidato da una regola esplicita + un test che ne impone il minimo (≥8 per registro) + un pool pronto da incollare. ✓

**3. Type consistency:** `ContentRegister`/`CONTENT_REGISTERS` identici in `deck.ts`/`rooms.ts` (Task 1-2) ed `events.ts` (Task 3); `startGame(code, dilemmaCount, register?)` usato coerentemente in rooms (Task 2), index (Task 4) e nello script di verifica (Task 6); il client invia `{ dilemmaCount: FORMAT_DILEMMA_COUNT[format], register }` (Task 5). `DILEMMA_COUNT_OPTIONS=[3,5,7]` allineato server/client. `makeDeck(register)` coerente tra costruttore e `startGame`. ✓

## Note di coordinamento con Ralph

- Eseguire a **loop Ralph fermo** (Pre-flight). Questo incremento **cambia la firma di `startGame`** e **rimuove `DILEMMA_COUNT_OPTIONS`/`INVALID_DILEMMA_COUNT`**: se Ralph riparte da un `prd.json` che ancora cita quei simboli (es. note US-004), le sue iterazioni vanno riallineate. Dopo il merge, aggiornare `prd.json`/`progress.txt` di conseguenza prima di riavviare `./ralph.sh`.
- File a rischio sovrapposizione con le prossime story Ralph (US-010+ difese/voti): principalmente `rooms.ts`, `index.ts`, `events.ts`, `HostApp.tsx`. Eseguire l'incremento per intero e committare prima di riavviare il loop.
