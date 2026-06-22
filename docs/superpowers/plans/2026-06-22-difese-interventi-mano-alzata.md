# Difese auto-paced + interventi a mano alzata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed-60s defense turn into a self-paced turn (minimum floor, then the speaker taps "Ho finito"), and add a raise-hand → `INTERVENTI` queue where each raised hand gets its own mini-turn; emoji reactions stay purely cosmetic but now float on every screen.

**Architecture:** A new `INTERVENTI` phase is woven into `advancePhase` between defender turns (not in the pure `nextPhase` sequence), mirroring how `ACCUSE`/`TAPPA_*` are special-cased. Each turn (defender or intervenor) has two server timestamps: `turnMinEndsAt` (floor, below which "Ho finito" is rejected) and `phaseExpiresAt` (safety cap, drives the existing auto-advance timer). Bots/absent speakers can't tap, so they fall back to a fixed timer. Raised hands are an ordered FIFO list collected only during a defender's turn; their count is public during the defense, their names only from `INTERVENTI` on.

**Tech Stack:** Server: Node + Express + Socket.IO, TypeScript CommonJS, vitest. Client: React + Vite, TypeScript ESM. No DB (in-memory state).

## Global Constraints

- **Votes stay secret:** never send individual votes/raised-hand identities to others. During DEFENSE only the aggregate `raisedCount` leaves the server; names appear only from `INTERVENTI` on (they're already-public speakers). (CLAUDE.md)
- **Timers are server-authoritative:** the server computes expiry timestamps; clients only render countdowns from `phaseExpiresAt` / `minEndsAt`. (CLAUDE.md)
- **No `any`** (lint error); prefix intentionally-unused vars/args with `_`. (CLAUDE.md)
- **Keep server (CJS) and client (ESM) module systems separate.** (CLAUDE.md)
- **Gate before every commit:** `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` must ALL stay green. (CLAUDE.md)
- **Durations (verbatim):** defense min `30_000`ms / cap `180_000`ms · intervento min `15_000`ms / cap `90_000`ms · bot/absent turn `60_000`ms.
- **Spec:** `docs/superpowers/specs/2026-06-22-difese-interventi-mano-alzata-design.md`. Award "Beniamino" is **kept** (reactions still accumulate `reactionsReceived`); do not remove it.
- **Out of scope:** Duello (`DUEL_ARGUE`) unchanged; no auto-paced voting changes. Percorso inherits automatically (same per-dilemma sequence).
- Run a single server test with: `npx vitest run server/src/game/__tests__/<file> -t "<name>"`.

## File Structure

**Server (modify):**
- `server/src/game/phases.ts` — add `INTERVENTI` to `GamePhase`, its duration, the min/cap/bot constants, and `isInterventiPhase`.
- `server/src/game/rooms.ts` — new `Room` fields + `create()` init + `DILEMMA_REVEAL` reset; `armTurn`; `raiseHand`; `finishTurn`; `currentSpeakerId`/`react` extended; `advancePhase` weaving; `publicDefense` extended; `leave` prune; new result types; re-export constants.
- `server/src/index.ts` — `player:raiseHand` + `player:finishTurn` socket handlers (+ `player:handRaised` echo).
- `server/src/game/__tests__/rooms.test.ts` — new tests (extend the existing `defenseRoom` helper usage).

**Client (modify/move):**
- `client/src/shared/events.ts` — mirror `INTERVENTI` (type + label), new `SocketEvents`, extended `DefenseState`.
- `client/src/shared/ReactionSwarm.tsx` + `client/src/shared/ReactionSwarm.module.css` — **moved** from `client/src/host/` (now shared by host + phone).
- `client/src/host/HostApp.tsx` — live ✋ count in DEFENSE + `INTERVENTI` queue panel; update import path.
- `client/src/player/PlayerApp.tsx` — "Ho finito" button, raise-hand toggle, `INTERVENTI` rendering, phone-side `ReactionSwarm`.

**Note (no change needed):** `server/src/game/roomSnapshot.ts` is field-agnostic (generic JSON + Map/Deck tagging) — the new plain array/number fields round-trip automatically.

---

### Task 1: Phase, constants, Room fields, per-round reset

**Files:**
- Modify: `server/src/game/phases.ts`
- Modify: `server/src/game/rooms.ts` (Room interface ~line 268-280, `create()` ~line 886-888, `DILEMMA_REVEAL` reset ~line 1103-1110, import line ~11)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `GamePhase` now includes `'INTERVENTI'`; exported consts `DEFENSE_MIN_MS=30_000`, `INTERVENTO_MIN_MS=15_000`, `DEFENSE_MAX_MS=180_000`, `INTERVENTI_MAX_MS=90_000`, `TURN_BOT_MS=60_000`; `isInterventiPhase(phase): boolean`. `Room` gains `raisedHands: string[]`, `interventiQueue: string[]`, `interventiIndex: number`, `turnMinEndsAt: number | null`.

- [ ] **Step 1: Write the failing test**

In `rooms.test.ts`, add near the other `describe` blocks:

```ts
import {
  DEFENSE_MIN_MS,
  INTERVENTO_MIN_MS,
  DEFENSE_MAX_MS,
  INTERVENTI_MAX_MS,
  TURN_BOT_MS,
  isInterventiPhase,
} from '../rooms';

describe('INTERVENTI phase constants + room fields', () => {
  it('exposes the floor/cap/bot durations', () => {
    expect([DEFENSE_MIN_MS, INTERVENTO_MIN_MS, DEFENSE_MAX_MS, INTERVENTI_MAX_MS, TURN_BOT_MS])
      .toEqual([30_000, 15_000, 180_000, 90_000, 60_000]);
  });
  it('DEFENSE cap is the 3-minute safety net', () => {
    expect(PHASE_DURATIONS_MS.DEFENSE).toBe(180_000);
    expect(PHASE_DURATIONS_MS.INTERVENTI).toBe(90_000);
  });
  it('isInterventiPhase only matches INTERVENTI', () => {
    expect(isInterventiPhase('INTERVENTI')).toBe(true);
    expect(isInterventiPhase('DEFENSE')).toBe(false);
  });
  it('initializes the raised-hand/interventi fields on create', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const room = store.get(code)!;
    expect(room.raisedHands).toEqual([]);
    expect(room.interventiQueue).toEqual([]);
    expect(room.interventiIndex).toBe(0);
    expect(room.turnMinEndsAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "INTERVENTI phase constants"`
Expected: FAIL — `DEFENSE_MIN_MS`/`isInterventiPhase` not exported, `PHASE_DURATIONS_MS.DEFENSE` is 60_000.

- [ ] **Step 3: Edit `phases.ts`**

Add `'INTERVENTI'` to the `GamePhase` union, right after `'DEFENSE'`:

```ts
  | 'DEFENSE'
  | 'INTERVENTI'
  | 'VOTE_2'
```

Add the per-turn duration constants above `PHASE_DURATIONS_MS`:

```ts
/**
 * Per-turn timing for the self-paced defense + interventi. A human speaker gets a
 * MIN floor (below which "Ho finito" is rejected) and a generous MAX safety cap;
 * a bot or absent speaker (who can't tap) just gets TURN_BOT_MS.
 */
export const DEFENSE_MIN_MS = 30_000;
export const INTERVENTO_MIN_MS = 15_000;
export const DEFENSE_MAX_MS = 180_000;
export const INTERVENTI_MAX_MS = 90_000;
export const TURN_BOT_MS = 60_000;
```

In `PHASE_DURATIONS_MS`, change the `DEFENSE` value to the cap and add `INTERVENTI` (both are the safety caps; `armTurn` overrides per-turn):

```ts
  DEFENSE: DEFENSE_MAX_MS,
  INTERVENTI: INTERVENTI_MAX_MS,
```

Add the helper near `isDefensePhase`:

```ts
/** Phase in which queued players take their post-defense mini-turns. */
export function isInterventiPhase(phase: GamePhase): boolean {
  return phase === 'INTERVENTI';
}
```

(`INTERVENTI` is intentionally **not** added to `DILEMMA_SEQUENCE` — it's woven in `advancePhase`, like `ACCUSE`.)

- [ ] **Step 4: Edit `rooms.ts` — re-export + Room fields + init + reset**

`rooms.ts` already re-exports from `./phases`. Add the new names to that import/re-export block (the existing `import { ... isDefensePhase ... } from './phases'` near line 11, and the corresponding `export { ... }` if present). Add: `DEFENSE_MIN_MS, INTERVENTO_MIN_MS, DEFENSE_MAX_MS, INTERVENTI_MAX_MS, TURN_BOT_MS, isInterventiPhase`.

In the `Room` interface, after `defenseArgument` (~line 280) add:

```ts
  /**
   * Raised hands during the CURRENT defender's turn, in FIFO order (player ids).
   * The speaking order for the INTERVENTI mini-turns that follow. Reset at the
   * start of each defender turn and on DILEMMA_REVEAL; pruned on leave.
   */
  raisedHands: string[];
  /** Frozen snapshot of raisedHands taken when a defender finishes; walked in INTERVENTI. */
  interventiQueue: string[];
  /** Which intervenor (0-based) is speaking during INTERVENTI. */
  interventiIndex: number;
  /**
   * When the current turn's minimum elapses (epoch ms); below it "Ho finito" is
   * rejected. null for bot/absent speakers (no floor) and outside DEFENSE/INTERVENTI.
   */
  turnMinEndsAt: number | null;
```

In `create()` (after `defenseArgument: null,`):

```ts
      raisedHands: [],
      interventiQueue: [],
      interventiIndex: 0,
      turnMinEndsAt: null,
```

In `advancePhase`, inside the `if (transition.phase === 'DILEMMA_REVEAL')` reset block (alongside `room.votes.clear()` etc.), add:

```ts
      room.raisedHands = [];
      room.interventiQueue = [];
      room.interventiIndex = 0;
      room.turnMinEndsAt = null;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "INTERVENTI phase constants"`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck (the new GamePhase member forces exhaustive maps)**

Run: `npm run typecheck`
Expected: PASS. If `PHASE_DURATIONS_MS` or other `Record<GamePhase, …>` complains about a missing `INTERVENTI`, you missed adding the key — add it.

- [ ] **Step 7: Commit**

```bash
git add server/src/game/phases.ts server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): add INTERVENTI phase, per-turn constants + room fields"
```

---

### Task 2: `armTurn` — per-turn min/cap timers (human vs bot)

**Files:**
- Modify: `server/src/game/rooms.ts` (new private `armTurn`; call it on DEFENSE entry ~line 1118-1122)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `currentSpeakerId(room)` (existing private), `Player.isBot`.
- Produces: `private armTurn(room: Room): void` — sets `room.turnMinEndsAt` + `room.phaseExpiresAt` for the current DEFENSE/INTERVENTI speaker. On DEFENSE entry a human defender gets `now+DEFENSE_MIN_MS` / `now+DEFENSE_MAX_MS`.

- [ ] **Step 1: Write the failing test**

```ts
describe('armTurn on DEFENSE entry', () => {
  it('a human defender gets the 30s floor and 180s cap', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // first defender is human P0/P? (side A)
    const room = store.get(code)!;
    expect(room.phase).toBe('DEFENSE');
    expect(room.turnMinEndsAt).toBe(now + 30_000);
    expect(room.phaseExpiresAt).toBe(now + 180_000);
  });
});
```

(Note: `defenseRoom` already drives a fresh room into DEFENSE using injected rng; here `now` is fixed at 1_000 across the helper calls.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "armTurn on DEFENSE entry"`
Expected: FAIL — `turnMinEndsAt` is null and `phaseExpiresAt` is `1_000 + 60_000` (old DEFENSE value via expiryFor), not the new floor/cap.

- [ ] **Step 3: Implement `armTurn`**

Add this private method near `expiryFor` (~line 603):

```ts
  /**
   * Set the current turn's minimum-floor + safety-cap timers for the speaker in
   * DEFENSE/INTERVENTI. A human speaker gets a MIN (below which "Ho finito" is
   * rejected) plus a generous cap; a bot or absent speaker can't tap, so they get
   * only TURN_BOT_MS and no floor. Overrides whatever expiryFor set generically.
   */
  private armTurn(room: Room): void {
    const interventi = room.phase === 'INTERVENTI';
    const speakerId = this.currentSpeakerId(room);
    const speaker = speakerId ? room.players.get(speakerId) : undefined;
    const now = this.now();
    if (speaker && !speaker.isBot) {
      room.turnMinEndsAt = now + (interventi ? INTERVENTO_MIN_MS : DEFENSE_MIN_MS);
      room.phaseExpiresAt = now + (interventi ? INTERVENTI_MAX_MS : DEFENSE_MAX_MS);
    } else {
      room.turnMinEndsAt = null;
      room.phaseExpiresAt = now + TURN_BOT_MS;
    }
  }
```

In `advancePhase`, in the `if (transition.phase === 'DEFENSE')` block (~line 1118), after the existing three lines, add the reset + arm:

```ts
    if (transition.phase === 'DEFENSE') {
      room.defenders = this.selectDefenders(room);
      room.defenseTurnIndex = 0;
      room.defenseArgument = this.argumentForCurrentDefender(room);
      room.raisedHands = [];
      this.armTurn(room);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "armTurn on DEFENSE entry"`
Expected: PASS.

- [ ] **Step 5: Run the whole defense suite for regressions**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: PASS. (Old tests asserting `phaseExpiresAt === now + 60_000` on DEFENSE entry, if any, must be updated to `now + 180_000`. Search the file for `DEFENSE` expiry assertions and fix to the cap.)

- [ ] **Step 6: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): arm per-turn floor+cap timers on DEFENSE entry"
```

---

### Task 3: `raiseHand` — toggle the FIFO queue

**Files:**
- Modify: `server/src/game/rooms.ts` (new `RaiseHandError`/`RaiseHandResult` types + `raiseHand` method)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `raiseHand(code, playerId): { ok: true; room: Room; raised: boolean } | { ok: false; error: RaiseHandError }` where `RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER'`. Mutates `room.raisedHands` (FIFO append / remove on re-toggle).

- [ ] **Step 1: Write the failing test**

```ts
describe('raiseHand', () => {
  function room4(store: RoomStore) {
    // 4 players, split A/B/B/B → first defender is the lone A voter.
    return defenseRoom(store, ['A', 'B', 'B', 'B']);
  }
  it('queues non-speakers in FIFO order and toggles off', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = room4(store);
    const speaker = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== speaker);
    expect(store.raiseHand(code, others[0])).toMatchObject({ ok: true, raised: true });
    expect(store.raiseHand(code, others[1])).toMatchObject({ ok: true, raised: true });
    expect(store.get(code)!.raisedHands).toEqual([others[0], others[1]]);
    // toggle the first off
    expect(store.raiseHand(code, others[0])).toMatchObject({ ok: true, raised: false });
    expect(store.get(code)!.raisedHands).toEqual([others[1]]);
  });
  it('rejects the current speaker and the wrong phase', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = room4(store);
    const speaker = store.get(code)!.defenders[0].id;
    expect(store.raiseHand(code, speaker)).toEqual({ ok: false, error: 'IS_SPEAKER' });
    store.advancePhase(code); // leave DEFENSE turn(s) eventually; force a non-DEFENSE phase
    while (store.get(code)!.phase === 'DEFENSE' || store.get(code)!.phase === 'INTERVENTI') store.advancePhase(code);
    expect(store.raiseHand(code, speaker)).toEqual({ ok: false, error: 'NOT_RAISE_PHASE' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "raiseHand"`
Expected: FAIL — `store.raiseHand` is not a function.

- [ ] **Step 3: Implement `raiseHand`**

Add the result types near the other `*Result` types (e.g. by `ReactResult`):

```ts
export type RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER';
export type RaiseHandResult =
  | { ok: true; room: Room; raised: boolean }
  | { ok: false; error: RaiseHandError };
```

Add the method near `react`:

```ts
  /**
   * Toggle a player's raised hand during a defender's turn (DEFENSE only). Anyone
   * present except the current speaker may queue; raising again lowers it. The FIFO
   * order is the speaking order for the INTERVENTI mini-turns that follow. The
   * identities never leave the server during DEFENSE — only the aggregate count.
   */
  raiseHand(code: string, playerId: string): RaiseHandResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'DEFENSE') return { ok: false, error: 'NOT_RAISE_PHASE' };
    if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
    if (this.currentSpeakerId(room) === playerId) return { ok: false, error: 'IS_SPEAKER' };
    const i = room.raisedHands.indexOf(playerId);
    if (i >= 0) {
      room.raisedHands.splice(i, 1);
      return { ok: true, room, raised: false };
    }
    room.raisedHands.push(playerId);
    return { ok: true, room, raised: true };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "raiseHand"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): raiseHand toggles a FIFO interventi queue"
```

---

### Task 4: `finishTurn` — speaker ends after the minimum

**Files:**
- Modify: `server/src/game/rooms.ts` (new `FinishTurnError`/`FinishTurnResult` + `finishTurn`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `finishTurn(code, playerId): { ok: true; room: Room } | { ok: false; error: FinishTurnError }` where `FinishTurnError = 'ROOM_NOT_FOUND' | 'NOT_FINISHING_PHASE' | 'NOT_SPEAKER' | 'TOO_EARLY'`. Validates only (does not advance — the index handler calls `advancePhase`).

- [ ] **Step 1: Write the failing test**

```ts
describe('finishTurn', () => {
  it('is rejected before the minimum, accepted after, and only from the speaker', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    const speaker = store.get(code)!.defenders[0].id;
    const other = [...store.get(code)!.players.keys()].find((id) => id !== speaker)!;
    expect(store.finishTurn(code, other)).toEqual({ ok: false, error: 'NOT_SPEAKER' });
    expect(store.finishTurn(code, speaker)).toEqual({ ok: false, error: 'TOO_EARLY' }); // now < min (1_000+30_000)
    now = 1_000 + 30_000; // exactly at the floor
    expect(store.finishTurn(code, speaker)).toMatchObject({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "finishTurn"`
Expected: FAIL — `store.finishTurn` is not a function.

- [ ] **Step 3: Implement `finishTurn`**

Add the types near `RaiseHandResult`:

```ts
export type FinishTurnError = 'ROOM_NOT_FOUND' | 'NOT_FINISHING_PHASE' | 'NOT_SPEAKER' | 'TOO_EARLY';
export type FinishTurnResult = { ok: true; room: Room } | { ok: false; error: FinishTurnError };
```

Add the method near `raiseHand`:

```ts
  /**
   * The current speaker (defender in DEFENSE, intervenor in INTERVENTI) signals
   * they are done. Valid only from the speaker and only once the per-turn minimum
   * has elapsed; the caller (index.ts) then advances the turn like the timer would.
   */
  finishTurn(code: string, playerId: string): FinishTurnResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') {
      return { ok: false, error: 'NOT_FINISHING_PHASE' };
    }
    if (this.currentSpeakerId(room) !== playerId) return { ok: false, error: 'NOT_SPEAKER' };
    if (room.turnMinEndsAt != null && this.now() < room.turnMinEndsAt) {
      return { ok: false, error: 'TOO_EARLY' };
    }
    return { ok: true, room };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "finishTurn"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): finishTurn validates speaker + minimum floor"
```

---

### Task 5: `advancePhase` weaving — DEFENSE ↔ INTERVENTI

**Files:**
- Modify: `server/src/game/rooms.ts` (`advancePhase` ~lines 1052-1060 + insert INTERVENTI handling)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `armTurn`, `argumentForCurrentDefender`, `room.raisedHands/interventiQueue/interventiIndex`.
- Produces: After a defender finishes with a non-empty queue → `phase='INTERVENTI'`; walking the queue advances `interventiIndex`; queue exhausted → next defender (`DEFENSE`) or fall through to `VOTE_2`. Interventi are per-defender.

- [ ] **Step 1: Write the failing test**

```ts
describe('advancePhase weaving DEFENSE/INTERVENTI', () => {
  it('a defender with raised hands enters INTERVENTI, walks the queue, then resumes', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    // Single side voting → exactly ONE defender, so after interventi we go to VOTE_2.
    const code = defenseRoom(store, ['A', 'A', 'A']);
    const defender = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== defender);
    store.raiseHand(code, others[0]);
    store.raiseHand(code, others[1]);
    // defender finishes (timer/finishTurn → advancePhase)
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    expect(store.get(code)!.interventiQueue).toEqual([others[0], others[1]]);
    expect(store.get(code)!.interventiIndex).toBe(0);
    expect(store.get(code)!.raisedHands).toEqual([]); // frozen + cleared
    // first intervenor finishes → second intervenor
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    expect(store.get(code)!.interventiIndex).toBe(1);
    // second intervenor finishes → queue exhausted, one defender → VOTE_2
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });

  it('a defender with NO raised hands skips INTERVENTI', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']); // one defender, no hands
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });

  it('runs interventi per-defender (two sides)', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // two defenders (A then B)
    const d0 = store.get(code)!.defenders[0].id;
    const other = [...store.get(code)!.players.keys()].find((id) => id !== d0)!;
    store.raiseHand(code, other);            // hand during defender 0
    store.advancePhase(code);                // → INTERVENTI for defender 0
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    store.advancePhase(code);                // intervenor done → defender 1
    expect(store.get(code)!.phase).toBe('DEFENSE');
    expect(store.get(code)!.defenseTurnIndex).toBe(1);
    store.advancePhase(code);                // defender 1 done, no hands → VOTE_2
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "advancePhase weaving"`
Expected: FAIL — current code goes DEFENSE→VOTE_2 (or next defender) without INTERVENTI.

- [ ] **Step 3: Replace the DEFENSE-turn block + add INTERVENTI handling**

In `advancePhase`, replace the existing block (~lines 1052-1060):

```ts
    // DEFENSE runs one timed turn per defender. While turns remain, advance to
    // the next speaker (re-arming the per-turn timer) instead of leaving the
    // phase; only once every defender has spoken do we fall through to VOTE_2.
    if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) {
      room.defenseTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DEFENSE');
      room.defenseArgument = this.argumentForCurrentDefender(room);
      return { ok: true, room };
    }
```

with:

```ts
    // A finished INTERVENTI mini-turn: walk the frozen queue, then resume the
    // defenders (next defender or fall through to VOTE_2). Per-defender interventi.
    if (room.phase === 'INTERVENTI') {
      if (room.interventiIndex < room.interventiQueue.length - 1) {
        room.interventiIndex++;
        this.armTurn(room);
        return { ok: true, room };
      }
      room.interventiQueue = [];
      room.interventiIndex = 0;
      if (room.defenseTurnIndex < room.defenders.length - 1) {
        room.phase = 'DEFENSE';
        room.defenseTurnIndex++;
        room.raisedHands = [];
        room.defenseArgument = this.argumentForCurrentDefender(room);
        this.armTurn(room);
        return { ok: true, room };
      }
      // No defenders left: fall through to the normal DEFENSE -> VOTE_2 transition.
      room.phase = 'DEFENSE';
    }

    // A finished DEFENSE turn: if the defender drew raised hands, run their
    // interventi first; else advance to the next defender; else fall through.
    if (room.phase === 'DEFENSE' && room.raisedHands.length > 0) {
      room.phase = 'INTERVENTI';
      room.interventiQueue = [...room.raisedHands];
      room.interventiIndex = 0;
      room.raisedHands = [];
      this.armTurn(room);
      return { ok: true, room };
    }
    if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) {
      room.defenseTurnIndex++;
      room.raisedHands = [];
      room.defenseArgument = this.argumentForCurrentDefender(room);
      this.armTurn(room);
      return { ok: true, room };
    }
```

(The generic transition below then computes `nextPhase('DEFENSE') → VOTE_2` exactly as today.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "advancePhase weaving"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full server suite**

Run: `npm test`
Expected: PASS. Fix any defense-sequence test that assumed DEFENSE→VOTE_2 directly when hands exist (there should be none yet, since no other test raises hands).

- [ ] **Step 6: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): weave INTERVENTI mini-turns between defender turns"
```

---

### Task 6: `currentSpeakerId` + `react` cover INTERVENTI

**Files:**
- Modify: `server/src/game/rooms.ts` (`currentSpeakerId` ~line 1173, `react` phase guard ~line 1188)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `currentSpeakerId` returns the current intervenor in INTERVENTI; `react` accepts INTERVENTI (emoji attributed to the intervenor, accumulating their `reactionsReceived` — Beniamino still applies).

- [ ] **Step 1: Write the failing test**

```ts
describe('reactions during INTERVENTI', () => {
  it('attributes an emoji to the current intervenor', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']);
    const defender = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== defender);
    store.raiseHand(code, others[0]);
    store.advancePhase(code); // → INTERVENTI, intervenor = others[0]
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    const res = store.react(code, others[1], '👏');
    expect(res).toMatchObject({ ok: true, emoji: '👏' });
    const stats = store.get(code)!.stats.get(others[0]);
    expect(stats?.reactionsReceived).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "reactions during INTERVENTI"`
Expected: FAIL — `react` returns `NOT_REACTING_PHASE` in INTERVENTI.

- [ ] **Step 3: Extend both methods**

`currentSpeakerId` (add the INTERVENTI line):

```ts
  private currentSpeakerId(room: Room): string | null {
    if (room.phase === 'DEFENSE') return room.defenders[room.defenseTurnIndex]?.id ?? null;
    if (room.phase === 'INTERVENTI') return room.interventiQueue[room.interventiIndex] ?? null;
    if (room.phase === 'DUEL_ARGUE') return duelPlayers(room)[room.duelTurnIndex]?.id ?? null;
    return null;
  }
```

`react` phase guard (~line 1190): change

```ts
    if (room.phase !== 'DEFENSE' && room.phase !== 'DUEL_ARGUE') {
      return { ok: false, error: 'NOT_REACTING_PHASE' };
    }
```

to:

```ts
    if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI' && room.phase !== 'DUEL_ARGUE') {
      return { ok: false, error: 'NOT_REACTING_PHASE' };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "reactions during INTERVENTI"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): allow reactions + speaker lookup during INTERVENTI"
```

---

### Task 7: `publicDefense` — extended snapshot (count vs names)

**Files:**
- Modify: `server/src/game/rooms.ts` (`DefenseState` interface ~line 157, `publicDefense` ~line 1682)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `DefenseState` gains `kind: 'defense' | 'intervento'`, `speakerId: string | null`, `intervenor: { id: string; nickname: string } | null`, `raisedCount: number`, `queue: { id: string; nickname: string }[] | null`, `minEndsAt: number | null`, `canFinish: boolean`. During DEFENSE: `raisedCount` is the live count, `queue` is `null`. From INTERVENTI: `queue` carries the ordered names, `raisedCount` is 0.

- [ ] **Step 1: Write the failing test**

```ts
describe('publicDefense count vs names', () => {
  it('exposes only the count during DEFENSE, names from INTERVENTI', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']);
    const defender = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== defender);
    store.raiseHand(code, others[0]);
    store.raiseHand(code, others[1]);
    const d1 = store.publicDefense(code)!;
    expect(d1.kind).toBe('defense');
    expect(d1.raisedCount).toBe(2);
    expect(d1.queue).toBeNull();        // names hidden during defense
    expect(d1.speakerId).toBe(defender);

    store.advancePhase(code);            // → INTERVENTI
    const d2 = store.publicDefense(code)!;
    expect(d2.kind).toBe('intervento');
    expect(d2.queue?.map((q) => q.id)).toEqual([others[0], others[1]]); // names revealed
    expect(d2.speakerId).toBe(others[0]);
    expect(d2.intervenor?.id).toBe(others[0]);
  });
  it('canFinish flips once the floor passes', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']);
    expect(store.publicDefense(code)!.canFinish).toBe(false);
    now = 1_000 + 30_000;
    expect(store.publicDefense(code)!.canFinish).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "publicDefense count vs names"`
Expected: FAIL — `kind`/`raisedCount`/`queue`/`speakerId` are undefined.

- [ ] **Step 3: Extend `DefenseState`**

Replace the `DefenseState` interface (~line 157) with:

```ts
/** Public view of the defense/interventi phase: who is speaking + turn/queue state. */
export interface DefenseState {
  /** 'defense' = a chosen defender is speaking; 'intervento' = a queued mini-turn. */
  kind: 'defense' | 'intervento';
  /** The defender currently speaking (only in 'defense'); null in 'intervento'/no defenders. */
  speaker: Defender | null;
  /** The current intervenor (only in 'intervento'); null in 'defense'. */
  intervenor: { id: string; nickname: string } | null;
  /** Id of whoever is talking now (defender or intervenor), so the phone can match "your turn". */
  speakerId: string | null;
  /** 1-based index of the current turn (defense turn, or intervenor position). */
  turn: number;
  /** Total turns: defenders this round, or queued intervenors during INTERVENTI. */
  totalTurns: number;
  /** The bot defender's canned argument (Fase B); null for humans / interventi. */
  argument: string | null;
  /** Talking points for the defender's side; null in interventi / no speaker. */
  spunti: string[] | null;
  /** Live count of raised hands during the current defender's turn (0 in INTERVENTI). */
  raisedCount: number;
  /** Ordered intervenor names — only from INTERVENTI on; null during DEFENSE. */
  queue: { id: string; nickname: string }[] | null;
  /** When the current turn's minimum elapses (epoch ms); null for bot/absent speakers. */
  minEndsAt: number | null;
  /** Whether the current speaker may end now (minimum elapsed). */
  canFinish: boolean;
}
```

- [ ] **Step 4: Rewrite `publicDefense`**

Replace the method body (~line 1682):

```ts
  publicDefense(code: string): DefenseState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') return null;
    const canFinish = room.turnMinEndsAt == null || this.now() >= room.turnMinEndsAt;

    if (room.phase === 'INTERVENTI') {
      const speakerId = room.interventiQueue[room.interventiIndex] ?? null;
      const sp = speakerId ? room.players.get(speakerId) : undefined;
      const queue = room.interventiQueue
        .map((id) => {
          const p = room.players.get(id);
          return p ? { id: p.id, nickname: p.nickname } : null;
        })
        .filter((x): x is { id: string; nickname: string } => x != null);
      return {
        kind: 'intervento',
        speaker: null,
        intervenor: sp ? { id: sp.id, nickname: sp.nickname } : null,
        speakerId,
        turn: room.interventiIndex + 1,
        totalTurns: room.interventiQueue.length,
        argument: null,
        spunti: null,
        raisedCount: 0,
        queue,
        minEndsAt: room.turnMinEndsAt,
        canFinish,
      };
    }

    const totalTurns = room.defenders.length;
    const speaker = room.defenders[room.defenseTurnIndex] ?? null;
    const spunti =
      speaker && room.currentDilemma
        ? speaker.side === 'A'
          ? room.currentDilemma.spuntiA
          : room.currentDilemma.spuntiB
        : null;
    return {
      kind: 'defense',
      speaker,
      intervenor: null,
      speakerId: speaker?.id ?? null,
      turn: totalTurns === 0 ? 0 : room.defenseTurnIndex + 1,
      totalTurns,
      argument: room.defenseArgument,
      spunti,
      raisedCount: room.raisedHands.length,
      queue: null,
      minEndsAt: room.turnMinEndsAt,
      canFinish,
    };
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "publicDefense count vs names"`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck (DefenseState consumers)**

Run: `npm run typecheck --workspace server`
Expected: PASS. (Server-only consumers updated; the client mirror is Task 10.)

- [ ] **Step 7: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): publicDefense exposes count (DEFENSE) vs queue names (INTERVENTI)"
```

---

### Task 8: `leave` prunes the queues

**Files:**
- Modify: `server/src/game/rooms.ts` (`leave` ~line 1903)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `leave` removes the player from `raisedHands` and from `interventiQueue` (adjusting `interventiIndex` when an earlier entry is removed) so a departed player never speaks/displays.

- [ ] **Step 1: Write the failing test**

```ts
describe('leave prunes raised hands', () => {
  it('drops a leaver from the live queue', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']);
    const defender = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== defender);
    store.raiseHand(code, others[0]);
    store.raiseHand(code, others[1]);
    store.leave(code, others[0]);
    expect(store.get(code)!.raisedHands).toEqual([others[1]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leave prunes raised hands"`
Expected: FAIL — `raisedHands` still contains the leaver.

- [ ] **Step 3: Extend `leave`**

In `leave`, alongside the other `room.*.delete(playerId)` lines, add:

```ts
    room.raisedHands = room.raisedHands.filter((id) => id !== playerId);
    const qi = room.interventiQueue.indexOf(playerId);
    if (qi >= 0) {
      room.interventiQueue.splice(qi, 1);
      if (qi < room.interventiIndex) room.interventiIndex--;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leave prunes raised hands"`
Expected: PASS.

- [ ] **Step 5: Full gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. Commit.

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): prune raised-hand queues when a player leaves"
```

---

### Task 9: Socket wiring — `player:raiseHand` + `player:finishTurn`

**Files:**
- Modify: `server/src/index.ts` (new handlers near the `player:react` handler ~line 604; `player:handRaised` echo)
- Verify: no new server unit test (integration via manual e2e in Task 14); typecheck/lint gate.

**Interfaces:**
- Consumes: `rooms.raiseHand`, `rooms.finishTurn`, `advanceAndBroadcast`, `broadcastGameState`.
- Produces: server emits `player:handRaised { raised: boolean }` to the sender; `player:finishTurnError { error }` on rejection. `game:state` already carries `defense` (extended).

- [ ] **Step 1: Add the handlers**

In `server/src/index.ts`, after the `socket.on('player:react', …)` block (~line 609), add:

```ts
  // A player raises/lowers their hand during a defender's turn (DEFENSE). Toggle:
  // the server echoes the new state to the sender only (others see just the
  // aggregate ✋ count via game:state — never who raised, until INTERVENTI).
  socket.on('player:raiseHand', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.raiseHand(session.code, session.playerId);
    if (!result.ok) return;
    socket.emit('player:handRaised', { raised: result.raised });
    broadcastGameState(session.code);
  });

  // The current speaker (defender or intervenor) ends their turn from their phone,
  // valid only once the per-turn minimum has elapsed. Advances exactly like the
  // safety-cap timer would; rejection (too early / not the speaker) goes back only
  // to the sender.
  socket.on('player:finishTurn', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.finishTurn(session.code, session.playerId);
    if (!result.ok) {
      socket.emit('player:finishTurnError', { error: result.error });
      return;
    }
    advanceAndBroadcast(session.code);
  });
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck --workspace server && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(difese): socket handlers for raiseHand + finishTurn"
```

---

### Task 10: Client mirror — events.ts

**Files:**
- Modify: `client/src/shared/events.ts` (`GamePhase` ~line 250, `PHASE_LABELS` ~line 823, `SocketEvents` ~line 39, `DefenseState` ~line 387)

**Interfaces:**
- Produces: `SocketEvents.PlayerRaiseHand='player:raiseHand'`, `PlayerHandRaised='player:handRaised'`, `PlayerFinishTurn='player:finishTurn'`, `PlayerFinishTurnError='player:finishTurnError'`. `DefenseState` mirror matches the server (Task 7). `GamePhase` includes `'INTERVENTI'`; `PHASE_LABELS.INTERVENTI='Interventi'`.

- [ ] **Step 1: Add the phase + label**

In `GamePhase` (after `'DEFENSE'`):

```ts
  | 'DEFENSE'
  | 'INTERVENTI'
  | 'VOTE_2'
```

In `PHASE_LABELS` (after the `DEFENSE` line):

```ts
  DEFENSE: 'Le difese',
  INTERVENTI: 'Interventi',
```

- [ ] **Step 2: Add the socket event names**

In `SocketEvents`, after `PlayerReact`/`RoomReaction`:

```ts
  /** Player raises/lowers their hand during a defender's turn (DEFENSE). */
  PlayerRaiseHand: 'player:raiseHand',
  /** Server confirms the player's current raised-hand state back to them only. */
  PlayerHandRaised: 'player:handRaised',
  /** Current speaker (defender/intervenor) signals they are done (after the minimum). */
  PlayerFinishTurn: 'player:finishTurn',
  /** Server rejects the finish (too early / not the speaker / wrong phase). */
  PlayerFinishTurnError: 'player:finishTurnError',
```

- [ ] **Step 3: Replace the `DefenseState` mirror**

Replace `DefenseState` (~line 387) with the same shape as the server (copy from Task 7's interface verbatim, keeping the client's doc-comment style).

- [ ] **Step 4: Typecheck (this surfaces every client consumer that must change)**

Run: `npm run typecheck --workspace client`
Expected: FAIL in `HostApp.tsx`/`PlayerApp.tsx` (they read `defense.speaker`/`defense.turn` — still valid — but the new required fields don't break reads; the failure, if any, will be the missing `INTERVENTI` case in exhaustive `Record<GamePhase,…>` like `PHASE_LABELS`, now fixed). If typecheck PASSES here, even better — proceed. Do not "fix" consumers yet beyond what typecheck demands; Tasks 11-13 add the UI.

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/events.ts
git commit -m "feat(difese): mirror INTERVENTI phase + raiseHand/finishTurn events on the client"
```

---

### Task 11: Move ReactionSwarm to shared + render on the phone

**Files:**
- Create: `client/src/shared/ReactionSwarm.tsx`, `client/src/shared/ReactionSwarm.module.css` (moved content)
- Delete: `client/src/host/ReactionSwarm.tsx`, `client/src/host/ReactionSwarm.module.css`
- Modify: `client/src/host/HostApp.tsx` (import path ~line 18)
- Modify: `client/src/player/PlayerApp.tsx` (import + render during DEFENSE/INTERVENTI)

**Interfaces:**
- Produces: `client/src/shared/ReactionSwarm.tsx` default export (unchanged behavior — listens to `room:reaction`, floats emoji up). Imported by both host and player.

- [ ] **Step 1: Move the files**

```bash
git mv client/src/host/ReactionSwarm.tsx client/src/shared/ReactionSwarm.tsx
git mv client/src/host/ReactionSwarm.module.css client/src/shared/ReactionSwarm.module.css
```

In `client/src/shared/ReactionSwarm.tsx`, fix the relative imports (now one level different): `./shared/socket` → `./socket`, `./shared/events` → `./events`, `./ReactionSwarm.module.css` stays. Concretely the top imports become:

```ts
import { getSocket } from './socket';
import { SocketEvents, type RoomReactionPayload } from './events';
import styles from './ReactionSwarm.module.css';
```

- [ ] **Step 2: Update HostApp import**

In `client/src/host/HostApp.tsx` change:

```ts
import ReactionSwarm from './ReactionSwarm';
```
to:
```ts
import ReactionSwarm from '../shared/ReactionSwarm';
```

- [ ] **Step 3: Render on the phone**

In `client/src/player/PlayerApp.tsx`, add the import near the other shared imports:

```ts
import ReactionSwarm from '../shared/ReactionSwarm';
```

(The actual `<ReactionSwarm />` placement inside the DEFENSE/INTERVENTI view is added in Task 12.)

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck --workspace client && npm run build --workspace client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A client/src/shared/ReactionSwarm.tsx client/src/shared/ReactionSwarm.module.css client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx
git commit -m "refactor(difese): move ReactionSwarm to shared for host + phone"
```

---

### Task 12: PlayerApp — "Ho finito", raise-hand, INTERVENTI

**Files:**
- Modify: `client/src/player/PlayerApp.tsx` (the `phase === 'DEFENSE'` render ~line 647; socket effect for the `player:handRaised` echo; a small reset effect)

**Interfaces:**
- Consumes: `game.defense` (`kind`, `speakerId`, `intervenor`, `queue`, `minEndsAt`, `canFinish`, `raisedCount`, `speaker`, `spunti`), `SocketEvents.PlayerRaiseHand/PlayerHandRaised/PlayerFinishTurn`, `useCountdown`.

- [ ] **Step 1: Add local hand state + senders + echo listener**

Near the other `useState` hooks in the component, add:

```ts
  const [handRaised, setHandRaised] = useState(false);
```

Add senders near `sendReaction` (~line 401):

```ts
  const toggleHand = () => getSocket().emit(SocketEvents.PlayerRaiseHand);
  const sendFinish = () => getSocket().emit(SocketEvents.PlayerFinishTurn);
```

(`getSocket` is already imported in PlayerApp — reuse it; if the file uses a `socket` ref instead, follow that pattern.)

In the existing socket-listener `useEffect` (where `player:voted` etc. are registered), add:

```ts
    const onHandRaised = ({ raised }: { raised: boolean }) => setHandRaised(raised);
    socket.on(SocketEvents.PlayerHandRaised, onHandRaised);
```
and in its cleanup:
```ts
    socket.off(SocketEvents.PlayerHandRaised, onHandRaised);
```

Add a reset effect so a stale "raised" never sticks across turns/phases (the server clears `raisedHands` each new defender turn):

```ts
  const defenseSpeakerId = game?.defense?.speakerId ?? null;
  useEffect(() => {
    setHandRaised(false);
  }, [defenseSpeakerId, phase]);
```

- [ ] **Step 2: Compute the min-countdown + rewrite the DEFENSE/INTERVENTI view**

Near the top-level `const remaining = useCountdown(game?.phaseExpiresAt ?? null);` (~line 325) add:

```ts
  const minRemaining = useCountdown(game?.defense?.minEndsAt ?? null);
  const canFinishNow = (game?.defense?.minEndsAt == null) || (minRemaining ?? 0) <= 0;
```

Change the guard `if (joinedCode && phase === 'DEFENSE') {` to:

```ts
  if (joinedCode && (phase === 'DEFENSE' || phase === 'INTERVENTI')) {
    const d = game?.defense ?? null;
    const speaker = d?.speaker ?? null;            // defender (DEFENSE only)
    const myTurn = d?.speakerId != null && d.speakerId === playerId;
    const sideOption = speaker
      ? speaker.side === 'A' ? game?.dilemma?.optionA : game?.dilemma?.optionB
      : undefined;
    const myQueuePos = d?.queue ? d.queue.findIndex((q) => q.id === playerId) : -1;
    return (
      <main style={wrap}>
        <ReactionSwarm />
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>

        {myTurn ? (
          <>
            {phase === 'INTERVENTI' ? (
              <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te: intervieni! 🙋</p>
            ) : speaker?.devil ? (
              <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#ffd36b' }}>🎭 Avvocato del Diavolo!</p>
            ) : (
              <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
            )}

            {phase === 'DEFENSE' && speaker && (
              <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
                Difendi <strong>{speaker.side}</strong>{sideOption ? `: ${sideOption}` : ''}
              </p>
            )}
            {phase === 'DEFENSE' && d?.spunti && d.spunti.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '1.2rem', textAlign: 'left' }}>
                {d.spunti.map((s, i) => (<li key={`${i}-${s}`} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{s}</li>))}
              </ul>
            )}

            <button
              type="button"
              onClick={sendFinish}
              disabled={!canFinishNow}
              style={{
                fontSize: '1.2rem', fontWeight: 800, padding: '0.9rem 1.6rem', borderRadius: '0.9rem',
                border: 'none', cursor: canFinishNow ? 'pointer' : 'not-allowed',
                opacity: canFinishNow ? 1 : 0.5,
              }}
            >
              {canFinishNow ? 'Ho finito ▶' : `Ho finito tra ${minRemaining}s`}
            </button>
            {remaining != null && (
              <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>max {remaining}s</p>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: '1.3rem', margin: 0 }}>
              {phase === 'INTERVENTI'
                ? <>Interviene <strong>{d?.intervenor?.nickname ?? '…'}</strong> 🙋</>
                : <>Sta parlando <strong>{speaker?.nickname ?? '…'}</strong> 🎤</>}
            </p>

            {phase === 'DEFENSE' && d?.speakerId != null && (
              <button
                type="button"
                onClick={toggleHand}
                style={{
                  fontSize: '1.05rem', fontWeight: 700, padding: '0.7rem 1.3rem', borderRadius: '0.8rem',
                  border: handRaised ? '2px solid #ffd36b' : '2px solid rgba(255,255,255,0.3)',
                  background: handRaised ? 'rgba(255,211,107,0.18)' : 'transparent', cursor: 'pointer',
                }}
              >
                {handRaised ? '✋ Abbassa la mano' : '✋ Alza la mano'}
              </button>
            )}
            {phase === 'INTERVENTI' && myQueuePos >= 0 && (
              <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0 }}>Sei in coda: {myQueuePos + 1}º</p>
            )}

            <ReactionBar onReact={sendReaction} />
          </>
        )}

        {speaker == null && phase === 'DEFENSE' && (
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>Nessuna difesa per questo dilemma.</p>
        )}
        {skipButton}
      </main>
    );
  }
```

(This replaces the entire existing `if (joinedCode && phase === 'DEFENSE') { … }` block. Keep `skipButton` — it's the leader's "Avanti ▶" override. `ReactionSwarm` is rendered once at the top so emoji float on the phone.)

- [ ] **Step 3: Typecheck + lint + build**

Run: `npm run typecheck --workspace client && npm run lint && npm run build --workspace client`
Expected: PASS. (If `getSocket` isn't imported, add `import { getSocket } from '../shared/socket';` — check the existing import block first to match the file's socket pattern.)

- [ ] **Step 4: Commit**

```bash
git add client/src/player/PlayerApp.tsx
git commit -m "feat(difese): phone Ho-finito + raise-hand + interventi UI"
```

---

### Task 13: HostApp — live ✋ count + INTERVENTI panel

**Files:**
- Modify: `client/src/host/HostApp.tsx` (DEFENSE block ~line 288; new INTERVENTI block)

**Interfaces:**
- Consumes: `game.defense` (`raisedCount`, `queue`, `intervenor`, `speakerId`, `kind`).

- [ ] **Step 1: Add the live ✋ count in the DEFENSE block**

Inside the `phase === 'DEFENSE' && defense &&` → `defense.speaker ? (...)` section, after the side-badge `<div>` (just before the closing `</section>`), add:

```tsx
              {defense.raisedCount > 0 && (
                <p style={{ margin: 0, fontSize: '1.2rem', opacity: 0.85 }}>
                  ✋ {defense.raisedCount} {defense.raisedCount === 1 ? 'vuole' : 'vogliono'} intervenire
                </p>
              )}
```

- [ ] **Step 2: Add the INTERVENTI panel**

After the whole `phase === 'DEFENSE' && defense && ( … )` block (after its closing `)}` ~line 342), add:

```tsx
        {phase === 'INTERVENTI' && defense && (
          <section
            aria-label="Interventi"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              Interviene <span style={{ color: '#ffd36b' }}>{defense.intervenor?.nickname ?? '…'}</span> 🙋
            </p>
            {defense.queue && defense.queue.length > 0 && (
              <ol style={{ margin: 0, paddingLeft: '1.4rem', textAlign: 'left', display: 'inline-flex', flexDirection: 'column', gap: '0.3rem' }}>
                {defense.queue.map((q) => (
                  <li
                    key={q.id}
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: q.id === defense.speakerId ? 800 : 400,
                      opacity: q.id === defense.speakerId ? 1 : 0.6,
                    }}
                  >
                    {q.nickname}{q.id === defense.speakerId ? ' 🎤' : ''}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `npm run typecheck --workspace client && npm run lint && npm run build --workspace client`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "feat(difese): host live raised-hand count + interventi queue panel"
```

---

### Task 14: Full gate + manual end-to-end

**Files:** none (verification only).

- [ ] **Step 1: Full project gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: ALL PASS.

- [ ] **Step 2: Manual e2e**

Run `npm run dev`. Open `/host` on one screen and `/` on two phones (or browser tabs); create + join a room, add a bot if needed, start a short game and reach **Le difese**. Verify:
- The current defender's phone shows **"Ho finito"** disabled with a `Ho finito tra Ns` countdown; it enables after ~30s. Tapping it ends the turn.
- Other phones show **"✋ Alza la mano"** (toggles to "Abbassa la mano"); the host shows the live **✋ N** count but **no names**.
- Sending emoji makes them **float up on every screen** (host + both phones).
- After the defender finishes, the host shows the **Interventi** queue with names; each queued phone gets a mini-turn with its own **"Ho finito"** (min ~15s); non-speakers can still send emoji.
- With a single voting side (one defender) the round ends at the second vote after interventi; with both sides, interventi run per-defender.
- The leader's **"Avanti ▶"** force-advances at any time.

- [ ] **Step 3: Push the branch**

```bash
git push
```

(Per the user's standing rule: push the completed branch to the remote. If upstream is unset, `git push -u origin <branch>`. Never force-push.)

---

## Self-Review

**1. Spec coverage:**
- Defense min 30s + "Ho finito" → Tasks 2,4,12. ✓
- Cap 180s/90s + leader "Avanti" + bot 60s → Tasks 1,2 (`armTurn`), existing `leader:advancePhase`, schedulePhase timer. ✓
- Raise hand (anyone, toggle, FIFO) → Task 3. ✓
- INTERVENTI mini-turns, per-defender, min 15s → Tasks 1,5,2. ✓
- Count during DEFENSE / names from INTERVENTI → Task 7. ✓
- Reactions cosmetic, on all screens, separate; Beniamino kept → Tasks 6 (react in INTERVENTI, `reactionsReceived` untouched), 11 (phone swarm). ✓
- No new hands during interventi → `raiseHand` rejects non-DEFENSE (Task 3). ✓
- Percorso inherits / Duello unchanged / no vote-timer change → no DUEL or vote code touched. ✓
- Reset on DILEMMA_REVEAL / prune on leave → Tasks 1, 8. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" — each step carries real code. ✓

**3. Type consistency:** `DefenseState` fields (`kind`, `speaker`, `intervenor`, `speakerId`, `turn`, `totalTurns`, `argument`, `spunti`, `raisedCount`, `queue`, `minEndsAt`, `canFinish`) are identical in server (Task 7) and client mirror (Task 10). Methods: `raiseHand` → `{ ok, room, raised }`; `finishTurn` → `{ ok, room }`/error; `armTurn(room): void`; `currentSpeakerId` returns intervenor in INTERVENTI. Event names match between `index.ts` string literals and `SocketEvents` mirror (`player:raiseHand`, `player:handRaised`, `player:finishTurn`, `player:finishTurnError`). ✓
