# Engine Helpers Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Estrarre gli helper coesi dell'engine di `RoomStore` in funzioni pure testabili, lasciando i coordinatori (`advancePhase`/`startGame`/`advanceDuelPhase`) in `RoomStore`, senza cambiare comportamento.

**Architecture:** Funzioni pure su `Room` con la dipendenza usata passata esplicitamente (`rng`/`now`/`Deck`). I coordinatori in `rooms.ts` delegano. Import type-only da `rooms.ts` → nessun ciclo runtime. I 361 test esistenti sono la rete di regressione; ogni fetta aggiunge anche unit-test diretti con rng deterministico.

**Tech Stack:** TypeScript (server CJS), vitest.

## Global Constraints

- Server CJS; no `any` (lint error); vars inutilizzate con prefisso `_`.
- Zero cambi di comportamento/timer/regole. I 361 test restano verdi.
- Dipendenze passate come parametro esplicito minimo (no deps-bundle).
- Import dei tipi da `rooms.ts` **type-only**.
- Ogni task: gate verdi (typecheck/lint/test/build) → commit → push.

---

### Task 1: `botVotes.ts`

**Files:**
- Create: `server/src/game/botVotes.ts`
- Test: `server/src/game/__tests__/botVotes.test.ts`
- Modify: `server/src/game/rooms.ts` (rimuovi `castBotFirstVotes`/`applyBotSecondVotes`, importa+delega)

**Interfaces:**
- Produces: `castBotFirstVotes(room: Room, rng: () => number): void`, `applyBotSecondVotes(room: Room, rng: () => number): void`

- [ ] **Step 1: Implementare il modulo** — `server/src/game/botVotes.ts`:

```ts
// Bot voting behaviour, operating on a Room with an injected rng. Extracted from
// RoomStore; coordinators call these on entry to VOTE_1 / VOTE_2. Type-only import
// from rooms.ts keeps it cycle-free.
import type { Room, VoteChoice } from './rooms';
import { tally } from './voteCount';

/** Cast each bot's (random) first vote on entry to VOTE_1. */
export function castBotFirstVotes(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (p.isBot) room.votes.set(p.id, rng() < 0.5 ? 'A' : 'B');
  }
}

/**
 * Apply each bot's VOTE_2 swing based on its persona and the revealed first-vote
 * split (votes1): roccione holds; gregge drifts to the majority; bastian to the
 * minority; indeciso/equilibrato flip with a persona-specific probability. On a
 * tied split, gregge/bastian hold (no clear majority to chase).
 */
export function applyBotSecondVotes(room: Room, rng: () => number): void {
  const t = tally(room.votes1);
  const majority: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
  const minority: VoteChoice | null = majority ? (majority === 'A' ? 'B' : 'A') : null;
  for (const p of room.players.values()) {
    if (!p.isBot || !p.persona) continue;
    const current = room.votes.get(p.id);
    if (!current) continue;
    const other: VoteChoice = current === 'A' ? 'B' : 'A';
    let next: VoteChoice = current;
    switch (p.persona) {
      case 'roccione': break;
      case 'indeciso': next = rng() < 0.7 ? other : current; break;
      case 'equilibrato': next = rng() < 0.35 ? other : current; break;
      case 'gregge': if (minority && current === minority) next = majority as VoteChoice; break;
      case 'bastian': if (majority && current === majority) next = minority as VoteChoice; break;
    }
    room.votes.set(p.id, next);
  }
}
```

- [ ] **Step 2: Test diretto che fallisce** — `server/src/game/__tests__/botVotes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { castBotFirstVotes, applyBotSecondVotes } from '../botVotes';

// Build a room with one bot of a given persona and a known first-vote split.
function roomWith(persona: 'roccione' | 'gregge' | 'bastian') {
  const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
  const { code } = store.create();
  store.join(code, 'h1', 'H1');
  store.join(code, 'h2', 'H2');
  const room = store.get(code)!;
  room.players.set('b1', { id: 'b1', nickname: 'Bot', isBot: true, persona });
  return room;
}

describe('botVotes', () => {
  it('castBotFirstVotes gives every bot a vote', () => {
    const room = roomWith('roccione');
    castBotFirstVotes(room, () => 0); // rng 0 -> 'A'
    expect(room.votes.get('b1')).toBe('A');
  });

  it('roccione never changes its second vote', () => {
    const room = roomWith('roccione');
    room.votes1.set('h1', 'A');
    room.votes1.set('h2', 'A'); // majority A
    room.votes.set('b1', 'B');
    applyBotSecondVotes(room, () => 0);
    expect(room.votes.get('b1')).toBe('B');
  });

  it('gregge drifts from the minority to the majority', () => {
    const room = roomWith('gregge');
    room.votes1.set('h1', 'A');
    room.votes1.set('h2', 'A'); // majority A, minority B
    room.votes.set('b1', 'B');  // bot is in the minority
    applyBotSecondVotes(room, () => 0);
    expect(room.votes.get('b1')).toBe('A');
  });
});
```

Run: `npx vitest run server/src/game/__tests__/botVotes.test.ts`
Expected: FAIL (`castBotFirstVotes`/`applyBotSecondVotes` non importabili finché il modulo non esiste — al primo run con il modulo presente, PASS).

- [ ] **Step 3: Cablare in `rooms.ts`** — aggiungi l'import vicino agli altri `import * as`:

```ts
import * as botVotes from './botVotes';
```

Rimuovi i due metodi privati `castBotFirstVotes(room)` e `applyBotSecondVotes(room)` e sostituisci i loro chiamatori interni:
- `this.castBotFirstVotes(room)` → `botVotes.castBotFirstVotes(room, this.rng)`
- `this.applyBotSecondVotes(room)` → `botVotes.applyBotSecondVotes(room, this.rng)`

(Trova i chiamatori con `grep -n "this.castBotFirstVotes\|this.applyBotSecondVotes" server/src/game/rooms.ts`.)

- [ ] **Step 4: Gate verdi**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck/lint OK; test = 361 esistenti + i 3 nuovi tutti verdi; build OK. Rimuovi da `rooms.ts` l'import di `tally` SOLO se diventa inutilizzato (il lint lo segnala) — NON rimuoverlo se ancora usato altrove.

- [ ] **Step 5: Commit + push**

```bash
git add server/src/game/botVotes.ts server/src/game/__tests__/botVotes.test.ts server/src/game/rooms.ts
git commit -m "refactor(server): estrai botVotes (voti bot VOTE_1/VOTE_2) da RoomStore"
git push
```

---

### Task 2: `defenseSetup.ts`

**Files:**
- Create: `server/src/game/defenseSetup.ts`
- Test: `server/src/game/__tests__/defenseSetup.test.ts`
- Modify: `server/src/game/rooms.ts`

**Interfaces:**
- Consumes: `devilAdvocate.isDevilRound`, `defenseTurns.currentSpeakerId`, `botDefenseArgument` (da botDefense).
- Produces: `selectDefenders(room: Room, rng: () => number): Defender[]`, `armTurn(room: Room, now: number): void`, `argumentForCurrentDefender(room: Room, rng: () => number): string | null`

- [ ] **Step 1: Implementare il modulo** — `server/src/game/defenseSetup.ts`:

```ts
// DEFENSE entry setup: pick the defenders (one per side, devil-aware), arm the
// turn timer, and the bot defender's templated argument. Operates on a Room with
// injected rng/now. Type-only import from rooms.ts keeps it cycle-free.
import type { Room, Defender, VoteChoice } from './rooms';
import {
  DEFENSE_MIN_MS,
  INTERVENTO_MIN_MS,
  DEFENSE_MAX_MS,
  INTERVENTI_MAX_MS,
  TURN_BOT_MS,
} from './phases';
import { botDefenseArgument } from './botDefense';
import * as devilAdvocate from './devilAdvocate';
import * as defenseTurns from './defenseTurns';

/** Set the turn's start + min/max timers based on whether the speaker is a bot. */
export function armTurn(room: Room, now: number): void {
  const interventi = room.phase === 'INTERVENTI';
  const speakerId = defenseTurns.currentSpeakerId(room);
  const speaker = speakerId ? room.players.get(speakerId) : undefined;
  room.turnStartedAt = now;
  if (speaker && !speaker.isBot) {
    room.turnMinEndsAt = now + (interventi ? INTERVENTO_MIN_MS : DEFENSE_MIN_MS);
    room.phaseExpiresAt = now + (interventi ? INTERVENTI_MAX_MS : DEFENSE_MAX_MS);
  } else {
    room.turnMinEndsAt = null;
    room.phaseExpiresAt = now + TURN_BOT_MS;
  }
}

/**
 * Auto-select one defender per side from that side's secret voters (side A before
 * B). A side with 0 votes is skipped. Among a side's voters the least-used defender
 * is chosen (fairness), ties broken by the injected rng. In the devil round each
 * defender argues the OPPOSITE side.
 */
export function selectDefenders(room: Room, rng: () => number): Defender[] {
  const devil = devilAdvocate.isDevilRound(room);
  const defenders: Defender[] = [];
  for (const side of ['A', 'B'] as const) {
    const voters = [...room.votes.entries()]
      .filter(([, choice]) => choice === side)
      .map(([id]) => id);
    if (voters.length === 0) continue;
    const min = Math.min(...voters.map((id) => room.defenseCounts.get(id) ?? 0));
    const candidates = voters.filter((id) => (room.defenseCounts.get(id) ?? 0) === min);
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    const player = room.players.get(chosen);
    if (!player) continue;
    room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1);
    if (devil) {
      const argued: VoteChoice = side === 'A' ? 'B' : 'A';
      defenders.push({ id: player.id, nickname: player.nickname, side: argued, devil: true });
    } else {
      defenders.push({ id: player.id, nickname: player.nickname, side });
    }
  }
  return defenders;
}

/** The canned argument for the current defender if a bot, else null. */
export function argumentForCurrentDefender(room: Room, rng: () => number): string | null {
  const defender = room.defenders[room.defenseTurnIndex];
  if (!defender) return null;
  const player = room.players.get(defender.id);
  if (!player?.isBot || !player.persona || !room.currentDilemma) return null;
  return botDefenseArgument(player.persona, room.currentDilemma, defender.side, rng);
}
```

- [ ] **Step 2: Test diretto** — `server/src/game/__tests__/defenseSetup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { selectDefenders } from '../defenseSetup';

describe('defenseSetup.selectDefenders', () => {
  it('picks one defender per side that has votes', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    store.join(code, 'b1', 'B1');
    const room = store.get(code)!;
    room.votes.set('a1', 'A');
    room.votes.set('b1', 'B');
    const defenders = selectDefenders(room, () => 0);
    expect(defenders.map((d) => d.id).sort()).toEqual(['a1', 'b1']);
    expect(defenders.find((d) => d.id === 'a1')!.side).toBe('A');
  });

  it('skips a side with no votes', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    const room = store.get(code)!;
    room.votes.set('a1', 'A'); // only side A has votes
    const defenders = selectDefenders(room, () => 0);
    expect(defenders).toHaveLength(1);
    expect(defenders[0].id).toBe('a1');
  });
});
```

Run: `npx vitest run server/src/game/__tests__/defenseSetup.test.ts` → PASS.

- [ ] **Step 3: Cablare in `rooms.ts`** — `import * as defenseSetup from './defenseSetup';`. Rimuovi i 3 metodi privati `armTurn`/`selectDefenders`/`argumentForCurrentDefender` e sostituisci i chiamatori:
- `this.armTurn(room)` → `defenseSetup.armTurn(room, this.now())`
- `this.selectDefenders(room)` → `defenseSetup.selectDefenders(room, this.rng)`
- `this.argumentForCurrentDefender(room)` → `defenseSetup.argumentForCurrentDefender(room, this.rng)`

(`grep -n "this.armTurn\|this.selectDefenders\|this.argumentForCurrentDefender" server/src/game/rooms.ts`.)

- [ ] **Step 4: Gate verdi** — `npm run typecheck && npm run lint && npm test && npm run build`. Rimuovi da `rooms.ts` import diventati orfani SE segnalati dal lint (`DEFENSE_MIN_MS` ecc. solo se non più usati; `botDefenseArgument`, `duelPlayers` restano se usati altrove).

- [ ] **Step 5: Commit + push**

```bash
git add server/src/game/defenseSetup.ts server/src/game/__tests__/defenseSetup.test.ts server/src/game/rooms.ts
git commit -m "refactor(server): estrai defenseSetup (selectDefenders/armTurn/argument) da RoomStore"
git push
```

---

### Task 3: `dilemmaPlan.ts`

**Files:**
- Create: `server/src/game/dilemmaPlan.ts`
- Modify: `server/src/game/rooms.ts`

**Interfaces:**
- Produces: `buildClassicPlan(deck: Deck, submitted: Dilemma[], count: number, rng: () => number): Dilemma[]` (+ `buildPercorsoPlan` con la stessa firma del privato esistente).

- [ ] **Step 1: Leggere i metodi privati esistenti** per copiarne il corpo esatto.

Run: `grep -n "private buildClassicPlan\|private buildPercorsoPlan\|private shuffle" server/src/game/rooms.ts`
Poi leggi i corpi completi (il `shuffle` interno va incluso nel nuovo modulo come funzione locale che prende `rng`, oppure inline `Math.floor(rng()*…)`).

- [ ] **Step 2: Implementare `dilemmaPlan.ts`** copiando i corpi VERBATIM, sostituendo `this.rng` con il parametro `rng` e `this.shuffle(x)` con una funzione locale `shuffle(x, rng)`:

```ts
// Dilemma sequence planning (classic + percorso): build the ordered list a game
// plays through. Pure given a Deck + rng. Type-only import from rooms.ts keeps it
// cycle-free.
import { Deck, COMPLESSITA_RANK, type Dilemma } from './deck';
// NB: copiare buildClassicPlan/buildPercorsoPlan dai privati di rooms.ts,
// sostituendo this.rng -> rng e this.shuffle(arr) -> shuffle(arr, rng).

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// export function buildClassicPlan(deck, submitted, count, rng) { …corpo verbatim… }
// export function buildPercorsoPlan(…stessa firma del privato + rng…) { … }
```

- [ ] **Step 3: Cablare in `rooms.ts`** — `import * as dilemmaPlan from './dilemmaPlan';`. Rimuovi i privati `buildClassicPlan`/`buildPercorsoPlan` (e `shuffle` SE non usato altrove — controllare!). Sostituisci i chiamatori (in `startGame`):
- `this.buildClassicPlan(deck, submitted, count)` → `dilemmaPlan.buildClassicPlan(deck, submitted, count, this.rng)`
- `this.buildPercorsoPlan(...)` → `dilemmaPlan.buildPercorsoPlan(..., this.rng)`

ATTENZIONE: `shuffle` è probabilmente usato anche da altri privati (es. selectDefenders usava già rng diretto; verificare con `grep -n "this.shuffle" server/src/game/rooms.ts`). Rimuovi il privato `shuffle` da rooms.ts SOLO se non ha più chiamatori; altrimenti lascialo.

- [ ] **Step 4: Gate verdi** — `npm run typecheck && npm run lint && npm test && npm run build`. La rete (rooms.test.ts con rng deterministico) verifica che la sequenza dei dilemmi sia invariata.

- [ ] **Step 5: Commit + push**

```bash
git add server/src/game/dilemmaPlan.ts server/src/game/rooms.ts
git commit -m "refactor(server): estrai dilemmaPlan (buildClassic/PercorsoPlan) da RoomStore"
git push
```

---

### Task 4: Fold-in in `knowRound.ts` e `devilAdvocate.ts`

**Files:**
- Modify: `server/src/game/knowRound.ts` (+ `assignKnowTargets`, `pickKnowRound`)
- Modify: `server/src/game/devilAdvocate.ts` (+ `pickDevilRound`)
- Modify: `server/src/game/rooms.ts`

**Interfaces:**
- Produces: `knowRound.assignKnowTargets(room: Room): void`, `knowRound.pickKnowRound(dilemmaCount: number, devilRound: number | null, rng: () => number): number | null`, `devilAdvocate.pickDevilRound(dilemmaCount: number, rng: () => number): number | null`

- [ ] **Step 1: Aggiungere a `knowRound.ts`** (in fondo):

```ts
/**
 * Assign each connected human a target to guess (a ring: everyone guesses the next
 * player), clearing any stale guesses. With fewer than 2 humans nobody gets a target.
 */
export function assignKnowTargets(room: Room): void {
  room.knowTargets.clear();
  room.knowGuesses.clear();
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  if (humans.length < 2) return;
  for (let i = 0; i < humans.length; i++) {
    room.knowTargets.set(humans[i].id, humans[(i + 1) % humans.length].id);
  }
}

/**
 * Pick the surprise "Quanto mi conosci" round: a random round in [2..count] distinct
 * from the devil round. Only for longer games (>=5 dilemmas); null otherwise.
 */
export function pickKnowRound(dilemmaCount: number, devilRound: number | null, rng: () => number): number | null {
  if (dilemmaCount < 5) return null;
  const options: number[] = [];
  for (let i = 2; i <= dilemmaCount; i++) if (i !== devilRound) options.push(i);
  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)];
}
```

- [ ] **Step 2: Aggiungere a `devilAdvocate.ts`** (in fondo):

```ts
/**
 * Pick the surprise "Avvocato del Diavolo" round: a random 1-based dilemma index in
 * [2..dilemmaCount] (never the first round). null when there are fewer than 2 dilemmas.
 */
export function pickDevilRound(dilemmaCount: number, rng: () => number): number | null {
  if (dilemmaCount < 2) return null;
  return 2 + Math.floor(rng() * (dilemmaCount - 1));
}
```

- [ ] **Step 3: Cablare in `rooms.ts`** — rimuovi i privati `assignKnowTargets`/`pickKnowRound`/`pickDevilRound`. Sostituisci i chiamatori:
- `this.assignKnowTargets(room)` → `knowRound.assignKnowTargets(room)`
- `this.pickKnowRound(count, devil)` → `knowRound.pickKnowRound(count, devil, this.rng)`
- `this.pickDevilRound(count)` → `devilAdvocate.pickDevilRound(count, this.rng)`

(`grep -n "this.assignKnowTargets\|this.pickKnowRound\|this.pickDevilRound" server/src/game/rooms.ts`.)

- [ ] **Step 4: Gate verdi** — `npm run typecheck && npm run lint && npm test && npm run build`. 361 test verdi.

- [ ] **Step 5: Commit + push**

```bash
git add server/src/game/knowRound.ts server/src/game/devilAdvocate.ts server/src/game/rooms.ts
git commit -m "refactor(server): fold-in assignKnowTargets/pickKnowRound/pickDevilRound nei domini"
git push
```

---

## Self-Review

- **Spec coverage:** botVotes (Task 1) ✅, defenseSetup (Task 2) ✅, dilemmaPlan (Task 3) ✅, fold-in knowRound/devilAdvocate (Task 4) ✅. Coordinatori restano ✅.
- **Placeholder scan:** Task 3 lascia i corpi di buildClassic/PercorsoPlan da copiare VERBATIM (sono grandi e già esistenti — la copia verbatim con sostituzione `this.rng→rng` è l'azione esatta, non un placeholder di logica). Tutto il resto ha codice concreto.
- **Type consistency:** firme coerenti — `rng: () => number`, `now: number` (per armTurn), `Defender[]`/`Dilemma[]` come i tipi esistenti di rooms.ts.
