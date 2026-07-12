# FASE 0 — Il gioco non si ferma mai (anti-stallo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every way the party can freeze mid-game — a self-paced phone
phase with no timer, a disconnected defender stuck on stage, an offline
"leader" nobody can reach, an unbounded INTERVENTI queue, an impatient leader's
"Salta ▶" silently cutting off a slower player's secret vote, and a
double-gated advance condition in the "Quanto mi conosci" round that can end
the phase either too early or never.

**Architecture:** Eight small, surgical, independently-shippable fixes against
the existing server-authoritative state machine (`server/src/game/*`) and the
phone client (`client/src/player/*`). No new subsystems — each task extends an
existing pure function or existing socket handler. Tasks are ordered so each
commit leaves the gate green; two tasks (5 and 4→5 specifically) touch the
same `index.ts` handlers as an earlier task in this plan, so **execute the
tasks in the order given**, not in the spec's 0.1–0.8 numbering (each task's
title states its original spec item for traceability).

**Tech Stack:** Node + Express + Socket.IO server (TypeScript CommonJS, tsx in
dev), React + Vite client (TypeScript ESM), Vitest for both.

## Global Constraints

- TDD: write the failing test before the implementation, for every step that touches behavior.
- Full gate (`npm run typecheck && npm run lint && npm test && npm run build`) must stay green before every commit.
- Never send an individual secret vote/prediction/guess/accusation to the host or other players — only aggregate counts or (for this plan's item 0.2) the list of nicknames who *haven't* acted yet, which never reveals what they chose.
- Timers are server-authoritative: clients only render a countdown from a broadcast `phaseExpiresAt`; never invent a client-side timer.
- No `any` (lint error). Prefix intentionally-unused vars/args with `_`.
- Keep server (CJS) and client (ESM) module systems separate — don't import client code from server or vice versa.
- Commit after each task (or each step, if you prefer finer-grained history) with a message describing the fix, not the task number.
- Push to the remote at the end of the whole plan (per the user's standing rule), not after every task.

---

## Task 1 — Item 0.3: Disconnected defender never on stage

A player who has gone offline (phone locked/dropped, within the 45s
reconnect-grace window) can currently still be **selected** as a defender, and
even if selected, `armTurn` treats them as a normal human speaker (30s floor +
180s cap, waiting for a "Ho finito" tap they can never send from an offline
phone). Fix both: never pick a disconnected voter as a defender, and if one
somehow ends up speaking (e.g. they disconnect mid-INTERVENTI-queue), treat
them like a bot (no floor, `TURN_BOT_MS` cap only).

**Files:**
- Modify: `server/src/game/defenseSetup.ts:17-29` (`armTurn`), `:37-61` (`selectDefenders`)
- Test: `server/src/game/__tests__/defenseSetup.test.ts`

**Interfaces:**
- Consumes: `Room.players: Map<string, Player>` (`Player.connected?: false` means absent), existing `defenseSetup.selectDefenders(room, rng)` and `defenseSetup.armTurn(room, now)` signatures — unchanged.
- Produces: nothing new consumed by later tasks; this task's fix is self-contained.

- [ ] **Step 1: Write the failing test — `selectDefenders` skips a disconnected voter**

Add to `server/src/game/__tests__/defenseSetup.test.ts`:

```ts
  it('never selects a disconnected voter as a defender', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    store.join(code, 'a2', 'A2');
    const room = store.get(code)!;
    room.votes.set('a1', 'A');
    room.votes.set('a2', 'A');
    room.players.get('a1')!.connected = false; // a1 dropped mid-round
    const defenders = selectDefenders(room, () => 0);
    expect(defenders).toHaveLength(1);
    expect(defenders[0].id).toBe('a2');
  });

  it('skips a side entirely when every one of its voters is disconnected', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    store.join(code, 'b1', 'B1');
    const room = store.get(code)!;
    room.votes.set('a1', 'A');
    room.votes.set('b1', 'B');
    room.players.get('b1')!.connected = false;
    const defenders = selectDefenders(room, () => 0);
    expect(defenders).toHaveLength(1);
    expect(defenders[0].id).toBe('a1');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/defenseSetup.test.ts`
Expected: FAIL — both new tests select the disconnected player (defenders has length 2, or the disconnected id shows up).

- [ ] **Step 3: Fix `selectDefenders` to filter disconnected voters**

In `server/src/game/defenseSetup.ts`, change:

```ts
    const voters = [...room.votes.entries()]
      .filter(([, choice]) => choice === side)
      .map(([id]) => id);
```

to:

```ts
    const voters = [...room.votes.entries()]
      .filter(([, choice]) => choice === side)
      .map(([id]) => id)
      .filter((id) => room.players.get(id)?.connected !== false);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/defenseSetup.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Write the failing test — `armTurn` treats a disconnected speaker like a bot**

Add to the same file:

```ts
  it('armTurn gives a disconnected speaker the bot cap, not the human floor', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    const room = store.get(code)!;
    room.phase = 'DEFENSE';
    room.defenders = [{ id: 'a1', nickname: 'A1', side: 'A' }];
    room.defenseTurnIndex = 0;
    room.players.get('a1')!.connected = false;
    armTurn(room, 1_000);
    expect(room.turnMinEndsAt).toBeNull(); // no floor — they can't tap "Ho finito"
    expect(room.phaseExpiresAt).toBe(1_000 + TURN_BOT_MS);
  });
```

Add `armTurn` and `TURN_BOT_MS` to the file's imports: `import { armTurn, selectDefenders } from '../defenseSetup';` and `import { TURN_BOT_MS } from '../phases';`.

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/defenseSetup.test.ts`
Expected: FAIL — `turnMinEndsAt` is set to a non-null floor because the current code only checks `!speaker.isBot`.

- [ ] **Step 7: Fix `armTurn`**

In `server/src/game/defenseSetup.ts`, change:

```ts
  if (speaker && !speaker.isBot) {
```

to:

```ts
  if (speaker && !speaker.isBot && speaker.connected !== false) {
```

- [ ] **Step 8: Run the full server suite to verify no regression**

Run: `npm --prefix server test` (or `npm test` from repo root if it runs both workspaces)
Expected: PASS, all green.

- [ ] **Step 9: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

```bash
git add server/src/game/defenseSetup.ts server/src/game/__tests__/defenseSetup.test.ts
git commit -m "fix(defense): never put a disconnected player on stage as a defender"
```

---

## Task 2 — Item 0.5: Leadership migrates to a connected player

Today, when a player leaves for good (grace period expired), `leave()`
reassigns `leaderId` to "the next human in the roster" — with no check that
this replacement is actually *connected*. If the new "leader" is itself
mid-grace-period (offline, about to be dropped too), nobody's phone shows
leader controls (start/advance/Salta) until that second player also times out
or reconnects — a silent stall for up to another 45s, exactly the kind of
freeze this phase is meant to eliminate.

**Files:**
- Modify: `server/src/game/rooms.ts:1792-1796` (`leave`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `Room.leaderId: string | null`, `Room.players: Map<string, Player>`. `RoomStore.leave(code, playerId): boolean` signature unchanged.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `server/src/game/__tests__/rooms.test.ts` (near the other `leave`/leadership tests — search the file for `setLeader` or `isLeader` to find a good neighboring `describe` block, otherwise add a new one):

```ts
describe('leave() leadership migration', () => {
  it('skips a disconnected player when picking the next leader', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Cid');
    store.setLeader(code, 'p1');
    store.get(code)!.players.get('p2')!.connected = false; // Bob is mid-grace
    store.leave(code, 'p1'); // the leader (Ann) leaves for good
    expect(store.get(code)!.leaderId).toBe('p3'); // Cid, not the offline Bob
  });

  it('falls back to a disconnected human if nobody else is connected', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.setLeader(code, 'p1');
    store.get(code)!.players.get('p2')!.connected = false; // Bob is the only one left, and offline
    store.leave(code, 'p1');
    expect(store.get(code)!.leaderId).toBe('p2'); // better than null — they get control back on reconnect
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leave() leadership migration"`
Expected: FAIL on the first test — `leaderId` is `'p2'` (the disconnected Bob, first human found) instead of `'p3'`.

- [ ] **Step 3: Fix `leave()`**

In `server/src/game/rooms.ts`, change:

```ts
    const removed = room.players.delete(playerId);
    if (removed && room.leaderId === playerId) {
      const nextHuman = [...room.players.values()].find((p) => !p.isBot);
      room.leaderId = nextHuman ? nextHuman.id : null;
    }
    return removed;
```

to:

```ts
    const removed = room.players.delete(playerId);
    if (removed && room.leaderId === playerId) {
      const humans = [...room.players.values()].filter((p) => !p.isBot);
      const nextLeader = humans.find((p) => p.connected !== false) ?? humans[0];
      room.leaderId = nextLeader ? nextLeader.id : null;
    }
    return removed;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "leave() leadership migration"`
Expected: PASS, both tests.

- [ ] **Step 5: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS — no other test depended on the old "first human regardless of connection" behavior (grep confirmed no existing test sets `connected = false` before a `leave()` call other than the new ones).

- [ ] **Step 6: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "fix(rooms): leadership migration skips disconnected players"
```

---

## Task 3 — Item 0.6: Cap the INTERVENTI queue

Right now any number of players can raise their hand during a defender's
turn, and every one of them gets a full INTERVENTI mini-turn afterward — in a
big room a single defense could spawn 6+ consecutive 15–90s mini-turns,
exactly the kind of unbounded-wait the whole phase is trying to prevent. Cap
it to 3 concurrent raised hands; once full, reject further raises with a
`QUEUE_FULL` error the phone shows as "coda piena — reagisci!" so the player
still has something to do (react) instead of a raised hand that silently goes
nowhere.

**Files:**
- Modify: `server/src/game/defenseTurns.ts:22-33` (`raiseHand`)
- Modify: `server/src/game/rooms.ts:544` (`RaiseHandError` union)
- Modify: `server/src/index.ts:702-709` (`player:raiseHand` handler)
- Modify: `client/src/shared/events.ts` (new `SocketEvents.PlayerRaiseHandError`, `RaiseHandError` type, `PlayerRaiseHandErrorPayload`, `RAISE_HAND_ERROR_MESSAGES`)
- Modify: `client/src/player/PlayerApp.tsx` (new `raiseHandError` state + listener, pass to `DefenseView`)
- Modify: `client/src/player/views/DefenseView.tsx` (render the error)
- Test: `server/src/game/__tests__/rooms.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: `Room.raisedHands: string[]`, existing `defenseTurns.raiseHand(room, playerId): RaiseHandResult`.
- Produces: `defenseTurns.INTERVENTI_QUEUE_MAX = 3` (exported constant); `RaiseHandError` gains `'QUEUE_FULL'`; new socket event `player:raiseHandError` with payload `{ error: RaiseHandError }`.

- [ ] **Step 1: Write the failing server test**

Add to `server/src/game/__tests__/rooms.test.ts` (find the existing raise-hand tests — search for `raiseHand` — and add alongside):

```ts
describe('INTERVENTI queue cap', () => {
  it('rejects a 4th raised hand with QUEUE_FULL', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `p${i}`, `P${i}`);
    const room = store.get(code)!;
    room.phase = 'DEFENSE';
    room.defenders = [{ id: 'p0', nickname: 'P0', side: 'A' }];
    room.defenseTurnIndex = 0;
    expect(store.raiseHand(code, 'p1')).toEqual({ ok: true, room, raised: true });
    expect(store.raiseHand(code, 'p2')).toEqual({ ok: true, room, raised: true });
    expect(store.raiseHand(code, 'p3')).toEqual({ ok: true, room, raised: true });
    expect(store.raiseHand(code, 'p4')).toEqual({ ok: false, error: 'QUEUE_FULL' });
    expect(room.raisedHands).toHaveLength(3);
  });

  it('still allows lowering a hand even when the queue is full', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `p${i}`, `P${i}`);
    const room = store.get(code)!;
    room.phase = 'DEFENSE';
    room.defenders = [{ id: 'p0', nickname: 'P0', side: 'A' }];
    room.defenseTurnIndex = 0;
    store.raiseHand(code, 'p1');
    store.raiseHand(code, 'p2');
    store.raiseHand(code, 'p3');
    expect(store.raiseHand(code, 'p1')).toEqual({ ok: true, room, raised: false }); // lowers, not blocked
    expect(store.raiseHand(code, 'p4')).toEqual({ ok: true, room, raised: true }); // a slot freed up
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "INTERVENTI queue cap"`
Expected: FAIL — the 4th raise currently succeeds (no cap exists).

- [ ] **Step 3: Implement the cap in `defenseTurns.ts`**

Add above `raiseHand` in `server/src/game/defenseTurns.ts`:

```ts
/** Max simultaneous raised hands during a defender's turn — keeps the
 * post-defense INTERVENTI mini-round bounded no matter how big the room is. */
export const INTERVENTI_QUEUE_MAX = 3;
```

Change the body of `raiseHand`:

```ts
export function raiseHand(room: Room, playerId: string): RaiseHandResult {
  if (room.phase !== 'DEFENSE') return { ok: false, error: 'NOT_RAISE_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (currentSpeakerId(room) === playerId) return { ok: false, error: 'IS_SPEAKER' };
  const i = room.raisedHands.indexOf(playerId);
  if (i >= 0) {
    room.raisedHands.splice(i, 1);
    return { ok: true, room, raised: false };
  }
  if (room.raisedHands.length >= INTERVENTI_QUEUE_MAX) {
    return { ok: false, error: 'QUEUE_FULL' };
  }
  room.raisedHands.push(playerId);
  return { ok: true, room, raised: true };
}
```

In `server/src/game/rooms.ts`, change the `RaiseHandError` union (line 544):

```ts
export type RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER';
```

to:

```ts
export type RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER' | 'QUEUE_FULL';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "INTERVENTI queue cap"`
Expected: PASS.

- [ ] **Step 5: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS.

- [ ] **Step 6: Wire the error to the client — `index.ts`**

In `server/src/index.ts`, change the `player:raiseHand` handler:

```ts
  socket.on('player:raiseHand', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.raiseHand(session.code, session.playerId);
    if (!result.ok) return;
    socket.emit('player:handRaised', { raised: result.raised });
    broadcastGameState(session.code);
  });
```

to:

```ts
  socket.on('player:raiseHand', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.raiseHand(session.code, session.playerId);
    if (!result.ok) {
      socket.emit('player:raiseHandError', { error: result.error });
      return;
    }
    socket.emit('player:handRaised', { raised: result.raised });
    broadcastGameState(session.code);
  });
```

- [ ] **Step 7: Add the client-side types + event name**

In `client/src/shared/events.ts`, add to `SocketEvents` (near `PlayerHandRaised`):

```ts
  /** Server rejects the hand-raise (wrong phase, not in room, you're the speaker, queue full). */
  PlayerRaiseHandError: 'player:raiseHandError',
```

Add near the other error-payload/message-map pairs (e.g. after `SUBMIT_DILEMMA_ERROR_MESSAGES`):

```ts
export type RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER' | 'QUEUE_FULL';

export interface PlayerRaiseHandErrorPayload {
  error: RaiseHandError;
}

/** User-facing (Italian) messages for hand-raise errors. Only QUEUE_FULL is
 * normally reachable (the raise button is only shown when the phase/turn
 * already make the others valid) — the rest are defensive fallbacks. */
export const RAISE_HAND_ERROR_MESSAGES: Record<RaiseHandError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_RAISE_PHASE: 'Non è il momento di alzare la mano',
  NOT_IN_ROOM: 'Non sei in questa stanza',
  IS_SPEAKER: 'Stai già parlando tu',
  QUEUE_FULL: 'Coda piena — reagisci! 👏',
};
```

- [ ] **Step 8: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx` (near the other DEFENSE raise-hand tests, e.g. after "confirms to a spectator that their hand is raised (DEFENSE)"):

```tsx
  it('shows "coda piena" when the hand-raise queue is full (DEFENSE)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 3,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        leaderId: null,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /alza la mano/i }));
    act(() => {
      serverEmit('player:raiseHandError', { error: 'QUEUE_FULL' });
    });
    expect(screen.getByText(/coda piena/i)).toBeInTheDocument();
  });
```

- [ ] **Step 9: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "coda piena"`
Expected: FAIL — no such text is rendered yet (no state/listener/prop exists).

- [ ] **Step 10: Wire the client — `PlayerApp.tsx`**

Add a new state near `handRaised` (line ~153):

```ts
  const [raiseHandError, setRaiseHandError] = useState<string | null>(null);
```

Add a handler + registration next to `onHandRaised` (line ~239, ~260, ~309 — add, register, and clean up):

```ts
    const onHandRaised = ({ raised }: { raised: boolean }) => {
      setHandRaised(raised);
      setRaiseHandError(null);
    };
    const onRaiseHandError = ({ error }: { error: RaiseHandError }) =>
      setRaiseHandError(RAISE_HAND_ERROR_MESSAGES[error] ?? 'Non puoi alzare la mano ora');
```

```ts
    socket.on(SocketEvents.PlayerHandRaised, onHandRaised);
    socket.on(SocketEvents.PlayerRaiseHandError, onRaiseHandError);
```

```ts
      socket.off(SocketEvents.PlayerHandRaised, onHandRaised);
      socket.off(SocketEvents.PlayerRaiseHandError, onRaiseHandError);
```

Import `RaiseHandError` and `RAISE_HAND_ERROR_MESSAGES` alongside the file's other `../../shared/events` imports.

Clear it on phase change too — extend the existing hand-raise reset effect (line ~402):

```ts
  useEffect(() => {
    setHandRaised(false);
    setRaiseHandError(null);
  }, [turnSpeakerId, phase]);
```

Pass it to `DefenseView` (in the `DEFENSE`/`INTERVENTI` branch, line ~633-652):

```tsx
      <DefenseView
        phase={phase}
        defense={game?.defense ?? null}
        dilemma={game?.dilemma}
        isDevilRound={game?.isDevilRound ?? false}
        playerId={playerId}
        handRaised={handRaised}
        raiseHandError={raiseHandError}
        canFinishNow={canFinishNow}
        minRemaining={minRemaining}
        remaining={remaining}
        speakerElapsed={speakerElapsed}
        onFinish={sendFinish}
        onToggleHand={toggleHand}
        onReact={sendReaction}
        skipButton={skipButton}
      />
```

- [ ] **Step 11: Render it in `DefenseView.tsx`**

Add `raiseHandError: string | null;` to `DefenseViewProps` and the destructure. Change the existing hint paragraph (the one that reads "Alza la mano per intervenire dopo" / "✋ Mano alzata…"):

```tsx
          {phase === 'DEFENSE' && d?.speakerId != null && (
            <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
              {raiseHandError
                ? raiseHandError
                : handRaised
                  ? '✋ Mano alzata — potrai intervenire dopo le difese'
                  : 'Alza la mano per intervenire dopo'}
            </p>
          )}
```

- [ ] **Step 12: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 13: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/defenseTurns.ts server/src/game/rooms.ts server/src/index.ts \
  server/src/game/__tests__/rooms.test.ts client/src/shared/events.ts \
  client/src/player/PlayerApp.tsx client/src/player/views/DefenseView.tsx \
  client/src/player/PlayerApp.test.tsx
git commit -m "feat(interventi): cap the raised-hand queue to 3, surface QUEUE_FULL"
```

---

## Task 4 — Item 0.8: Unify the "Quanto mi conosci" advance gate

During a normal PREDICT phase, the phase ends early once every present human
has done both the side prediction and the swing bet (checked in the
`player:predict`/`player:swingBet` handlers). During the surprise "Quanto mi
conosci" round, PREDICT *also* carries a third action (guessing a friend's
vote), gated by an **entirely separate** check in the `player:knowGuess`
handler (`allKnowGuessed`) that knows nothing about predictions/swing bets,
and vice versa. Two independent, uncoordinated gates on the same phase means
either one can fire the early-advance while the other kind of input is still
incomplete — cutting a player's prediction, bet, or guess short. Replace both
with one combined predicate.

**Files:**
- Modify: `server/src/game/predictions.ts` (new `predictProgress`, `predictPhaseComplete`)
- Modify: `server/src/game/rooms.ts` (new `RoomStore.predictProgress`, `RoomStore.predictPhaseComplete` delegates)
- Modify: `server/src/index.ts:728-745` (`player:predict`), `:749-764` (`player:swingBet`), `:789-804` (`player:knowGuess`)
- Test: `server/src/game/__tests__/swingBet.test.ts` (or a new `predictPhaseComplete.test.ts` — this plan uses a new file to keep `swingBet.test.ts` focused on the ribaltone bet/award, per its existing `describe` scope)

**Interfaces:**
- Consumes: `Room.predictions/swingBets/knowTargets/knowGuesses` maps, `knowRound.isKnowRound(room)` (already exported).
- Produces: `predictions.predictProgress(room): { done: number; total: number; missingNicknames: string[] } | null` (null outside PREDICT) and `predictions.predictPhaseComplete(room): boolean` — **Task 8 consumes `predictProgress`** for its "missing predictors" list. **Task 5 deliberately does not** (it recomputes its own PREDICT completion ratio inline) so it stays independent of this task's file changes — see Task 5's Interfaces note.

- [ ] **Step 1: Write the failing test**

Create `server/src/game/__tests__/predictPhaseComplete.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

// A deterministic 8-dilemma fixture so a 5-round game (>=5 unlocks the "Quanto
// mi conosci" round) has enough draws; rng=()=>0 always picks round 2 as the
// know round when devilRound is null (see knowRound.pickKnowRound).
const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

// Drive a fresh 3-human room to PREDICT of a round, casting the given VOTE_1
// choices for sock-0..n first.
function reachPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 5); // 5 rounds unlocks the know round
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  return code;
}

describe('predictPhaseComplete — unified PREDICT advance gate', () => {
  it('outside the know round: true once predict + swingBet are both done, ignoring knowGuess', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // rng=()=>0 -> round 1, not the know round
    expect(store.get(code)!.knowRoundIndex).not.toBe(1);
    store.predict(code, 'sock-0', 'A');
    store.predict(code, 'sock-1', 'A');
    store.predict(code, 'sock-2', 'A');
    expect(store.predictPhaseComplete(code)).toBe(false); // swing bets missing
    store.swingBet(code, 'sock-0', 'regge');
    store.swingBet(code, 'sock-1', 'regge');
    store.swingBet(code, 'sock-2', 'regge');
    expect(store.predictPhaseComplete(code)).toBe(true);
  });

  it('in the know round: stays incomplete until predict + swingBet + knowGuess all land', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    // Walk to round 2, the know round with this fixture/rng.
    let g = 0;
    while (store.get(code)!.dilemmaIndex < 2 && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1') {
        (['A', 'A', 'B'] as VoteChoice[]).forEach((side, i) => store.vote(code, `sock-${i}`, side));
      }
    }
    expect(store.get(code)!.phase).toBe('PREDICT');
    expect(store.get(code)!.knowRoundIndex).toBe(2);
    for (let i = 0; i < 3; i++) {
      store.predict(code, `sock-${i}`, 'A');
      store.swingBet(code, `sock-${i}`, 'regge');
    }
    expect(store.predictPhaseComplete(code)).toBe(false); // knowGuess still missing
    const targets = [...store.get(code)!.knowTargets.keys()];
    for (const guesserId of targets) store.knowGuess(code, guesserId, 'A');
    expect(store.predictPhaseComplete(code)).toBe(true);
  });

  it('predictProgress lists who is still missing something, without their choice', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    store.predict(code, 'sock-0', 'A');
    store.swingBet(code, 'sock-0', 'regge');
    const progress = store.predictProgress(code)!;
    expect(progress.total).toBe(3);
    expect(progress.done).toBe(1);
    expect(progress.missingNicknames.sort()).toEqual(['P1', 'P2']);
  });

  it('predictProgress is null outside PREDICT', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    expect(store.predictProgress(code)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/predictPhaseComplete.test.ts`
Expected: FAIL — `store.predictPhaseComplete` / `store.predictProgress` don't exist yet (TypeError).

- [ ] **Step 3: Implement in `predictions.ts`**

In `server/src/game/predictions.ts`, add the import and two new exports:

```ts
import { isKnowRound } from './knowRound';
```

```ts
/** Whether one connected human has finished every action PREDICT asks of
 * them: the side prediction, the swing bet, and — in the "Quanto mi conosci"
 * round, only if they were assigned a target — their guess. */
function predictActionDone(room: Room, playerId: string): boolean {
  if (!room.predictions.has(playerId)) return false;
  if (!room.swingBets.has(playerId)) return false;
  if (isKnowRound(room) && room.knowTargets.has(playerId) && !room.knowGuesses.has(playerId)) {
    return false;
  }
  return true;
}

/**
 * How many connected humans have finished PREDICT and who's still missing
 * something (by nickname only — never which choice). Null outside PREDICT.
 * The single source of truth for both the early-advance gate below and the
 * "who are we waiting on" UI.
 */
export function predictProgress(
  room: Room,
): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'PREDICT') return null;
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  const missing = humans.filter((p) => !predictActionDone(room, p.id));
  return {
    done: humans.length - missing.length,
    total: humans.length,
    missingNicknames: missing.map((p) => p.nickname),
  };
}

/**
 * Single source of truth for "has everyone finished PREDICT?" — replaces the
 * old two independent call sites (the predict/swingBet handlers checked
 * predict+swingBet only; the knowGuess handler checked knowGuessed only),
 * which in the know round could each fire the early-advance before the
 * OTHER kind of input was done, cutting a player's action short.
 */
export function predictPhaseComplete(room: Room): boolean {
  const progress = predictProgress(room);
  return progress != null && progress.total > 0 && progress.done === progress.total;
}
```

- [ ] **Step 4: Add the `RoomStore` delegates**

In `server/src/game/rooms.ts`, add near the other PREDICT delegates (after `allSwingBet`, around line 1313):

```ts
  /**
   * How many connected humans have finished PREDICT (prediction + swing bet +,
   * in the know round, their guess) and who's still missing something, by
   * nickname only. Null outside PREDICT.
   */
  predictProgress(code: string): { done: number; total: number; missingNicknames: string[] } | null {
    const room = this.rooms.get(code);
    return room ? predictions.predictProgress(room) : null;
  }

  /** Single source of truth for "has everyone finished PREDICT?" (ends it early). */
  predictPhaseComplete(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? predictions.predictPhaseComplete(room) : false;
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/predictPhaseComplete.test.ts`
Expected: PASS, all four tests.

- [ ] **Step 6: Repoint the three `index.ts` call sites**

In `server/src/index.ts`, `player:predict` handler — change:

```ts
    if (rooms.allPredicted(code) && rooms.allSwingBet(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the predicted count for the host
    }
```

to:

```ts
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the predicted count for the host
    }
```

`player:swingBet` handler — same change (identical old/new snippet, different surrounding comment: "refresh the swing-bet count for the host").

`player:knowGuess` handler — change:

```ts
    socket.emit('player:knowGuessed', { choice: result.room.knowGuesses.get(playerId) });
    if (rooms.allKnowGuessed(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the guessed count
    }
```

to:

```ts
    socket.emit('player:knowGuessed', { choice: result.room.knowGuesses.get(playerId) });
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the guessed count
    }
```

Leave `rooms.allPredicted`, `rooms.allSwingBet`, `rooms.allKnowGuessed` (and their tests in `swingBet.test.ts`/`knowRound.test.ts`) untouched — they're still valid standalone predicates, just no longer the advance gate.

- [ ] **Step 7: Run the full test suite**

Run: `npm --prefix server test`
Expected: PASS. (No existing test should have relied on the old double-gate racing behavior — if one does, read it carefully: it was very likely asserting the *bug*, and should be updated to assert the unified behavior instead.)

- [ ] **Step 8: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/predictions.ts server/src/game/rooms.ts server/src/index.ts \
  server/src/game/__tests__/predictPhaseComplete.test.ts
git commit -m "fix(predict): unify the know-round advance gate into one predicate"
```

---

## Task 5 — Item 0.1: Soft-timeout + auto-default on self-paced phases

VOTE_1, VOTE_2, PREDICT and SPEAKER_VOTE have **no timer** (`PHASE_DURATIONS_MS`
is `null`) — they only ever end when every present player has acted, or the
leader force-advances. One distracted phone (present, connected, just not
tapping) freezes the whole table indefinitely. Fix: once ~70% of the players a
phase is waiting on have acted, arm a one-time, visible 45–60s countdown
(reusing the existing `phaseExpiresAt` + `schedulePhase` timer machinery — no
new client code needed, the countdown UI already renders whenever
`phaseExpiresAt` is non-null). When it fires, the phase is forced through like
any timed phase; PREDICT additionally backfills a plausible default
(prediction = the currently-leading side, swing bet = "regge") for anyone
still missing one, so their personal PHASE_RESULTS feedback still fires.
VOTE_1/VOTE_2/SPEAKER_VOTE stragglers are left as a straightforward
abstention — VOTE_2 already carries their VOTE_1 choice as the default, and
fabricating an opinion for VOTE_1/SPEAKER_VOTE would misattribute a stance
nobody actually chose.

**Files:**
- Modify: `server/src/game/phases.ts` (new `SOFT_TIMEOUT_THRESHOLD`, `SOFT_TIMEOUT_MS`)
- Modify: `server/src/game/predictions.ts` (new `applyPredictDefaults`)
- Modify: `server/src/game/rooms.ts` (new `RoomStore.maybeArmSoftTimeout`; call `predictions.applyPredictDefaults` in `advancePhase`)
- Modify: `server/src/index.ts` — `player:vote`, `player:confirmVote`, `player:predict`, `player:swingBet`, `player:knowGuess`, `player:voteSpeaker` handlers, and `refreshAfterRosterChange`
- Test: `server/src/game/__tests__/rooms.test.ts`, `server/src/game/__tests__/predictPhaseComplete.test.ts` (or a new file — this plan adds a dedicated `softTimeout.test.ts`)

**Interfaces:**
- Consumes: nothing from Tasks 1–4 (self-contained by design, to keep this task independent of Task 3/4's new helpers).
- Produces: `RoomStore.maybeArmSoftTimeout(code): boolean` — arms `room.phaseExpiresAt` and returns `true` iff it just did (caller must then call `schedulePhase(code)`). `predictions.applyPredictDefaults(room): void` — idempotent, safe to call unconditionally on every PREDICT exit.

- [ ] **Step 1: Write the failing test for `applyPredictDefaults`**

Create `server/src/game/__tests__/softTimeout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, SOFT_TIMEOUT_THRESHOLD, SOFT_TIMEOUT_MS, type VoteChoice } from '../rooms';
import { applyPredictDefaults } from '../predictions';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

function reachPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3);
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  return code;
}

describe('applyPredictDefaults', () => {
  it('fills the leading side + "regge" for anyone still missing, leaves actors alone', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // A leads 2-1
    store.predict(code, 'sock-0', 'B'); // sock-0 already acted — must be untouched
    store.swingBet(code, 'sock-0', 'ribalta');
    const room = store.get(code)!;
    applyPredictDefaults(room);
    expect(room.predictions.get('sock-0')).toBe('B'); // unchanged
    expect(room.swingBets.get('sock-0')).toBe('ribalta'); // unchanged
    expect(room.predictions.get('sock-1')).toBe('A'); // defaulted to the leader
    expect(room.swingBets.get('sock-1')).toBe('regge');
    expect(room.predictions.get('sock-2')).toBe('A');
    expect(room.swingBets.get('sock-2')).toBe('regge');
  });

  it('is a no-op outside PREDICT', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    const room = store.get(code)!;
    applyPredictDefaults(room);
    expect(room.predictions.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/softTimeout.test.ts`
Expected: FAIL — `applyPredictDefaults` doesn't exist (import error), and `SOFT_TIMEOUT_THRESHOLD`/`SOFT_TIMEOUT_MS` don't exist.

- [ ] **Step 3: Add the constants**

In `server/src/game/phases.ts`, add near the other timing constants (after `TURN_BOT_MS`):

```ts
/**
 * Self-paced phases (VOTE_1/VOTE_2/PREDICT/SPEAKER_VOTE) have no fixed timer —
 * they end once every present player has acted, or the leader skips. Once
 * this fraction of the players a phase is waiting on have acted, a visible
 * soft deadline kicks in so one distracted holdout can't freeze it forever.
 */
export const SOFT_TIMEOUT_THRESHOLD = 0.7;
export const SOFT_TIMEOUT_MS = 50_000;
```

- [ ] **Step 4: Implement `applyPredictDefaults`**

In `server/src/game/predictions.ts`, add (it already imports `tally` from `./voteCount`):

```ts
/**
 * Force a plausible default for any connected human still missing a PREDICT
 * action once the phase is forced through (soft-timeout or a leader skip):
 * the side prediction defaults to the currently-leading side (a tie -> A),
 * the swing bet defaults to "regge" (majority holds). Idempotent — a no-op
 * for anyone who already acted, so it's safe to call unconditionally on
 * every PREDICT exit.
 */
export function applyPredictDefaults(room: Room): void {
  if (room.phase !== 'PREDICT') return;
  const t = tally(room.votes);
  const leading: VoteChoice = t.A >= t.B ? 'A' : 'B';
  const present = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  for (const p of present) {
    if (!room.predictions.has(p.id)) room.predictions.set(p.id, leading);
    if (!room.swingBets.has(p.id)) room.swingBets.set(p.id, 'regge');
  }
}
```

- [ ] **Step 5: Run to verify the defaults test passes**

Run: `npx vitest run server/src/game/__tests__/softTimeout.test.ts`
Expected: PASS (the two `applyPredictDefaults` tests); the constants import will already resolve once Step 3 lands.

- [ ] **Step 6: Wire `applyPredictDefaults` into `advancePhase`**

In `server/src/game/rooms.ts`, in `advancePhase`, right before the line `let transition = step(room.phase, room.dilemmaIndex);`, add:

```ts
    // Backfill anyone still missing a PREDICT action so a forced advance
    // (soft-timeout or leader skip) doesn't just silently drop their result.
    // A no-op once everyone has already acted (the normal early-advance path).
    if (room.phase === 'PREDICT') predictions.applyPredictDefaults(room);
```

- [ ] **Step 7: Write the failing test for `maybeArmSoftTimeout`**

Add to `server/src/game/__tests__/softTimeout.test.ts`:

```ts
describe('maybeArmSoftTimeout', () => {
  it('arms a deadline once >=70% of present voters have voted in VOTE_1', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    expect(store.get(code)!.phaseExpiresAt).toBeNull();
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // 0/3 acted
    store.vote(code, 'sock-0', 'A');
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // 1/3 < 70%
    store.vote(code, 'sock-1', 'A'); // 2/3 = 67%... still short
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
    store.vote(code, 'sock-2', 'B'); // 3/3 -> but now everyone acted, nothing to wait on
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
  });

  it('arms once 2 of 3 have voted when the 3rd never will (a real 70%+ case)', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.join(code, 'sock-3', 'P3');
    store.startGame(code, 3);
    store.advancePhase(code);
    store.advancePhase(code); // VOTE_1, 4 present
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, 'sock-2', 'B'); // 3/4 = 75% >= 70%, sock-3 never votes
    expect(store.maybeArmSoftTimeout(code)).toBe(true);
    expect(store.get(code)!.phaseExpiresAt).toBe(5_000 + SOFT_TIMEOUT_MS);
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // already armed, no re-arm
  });

  it('does nothing for phases with a real timer (DEFENSE)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    store.get(code)!.phase = 'DEFENSE';
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
  });
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/softTimeout.test.ts -t "maybeArmSoftTimeout"`
Expected: FAIL — `store.maybeArmSoftTimeout` doesn't exist yet.

- [ ] **Step 9: Implement `maybeArmSoftTimeout`**

In `server/src/game/rooms.ts`, add a new `RoomStore` method (a good spot: right after `advancePhase`, before `private advanceDuelPhase`):

```ts
  /**
   * Arm a one-time soft deadline for a self-paced voting phase (VOTE_1/
   * VOTE_2/PREDICT/SPEAKER_VOTE) once ~70% of the players it's waiting on
   * have acted, so one distracted holdout can't freeze it forever — the
   * existing schedulePhase/advanceAndBroadcast timer machinery (index.ts)
   * then forces it through exactly like any timed phase. No-ops if the phase
   * already has a deadline (a real timer, or an already-armed soft one),
   * isn't one of these four, or nobody is actually missing.
   */
  maybeArmSoftTimeout(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.phaseExpiresAt != null) return false;
    let total = 0;
    let acted = 0;
    if (room.phase === 'VOTE_1' || room.phase === 'VOTE_2') {
      const present = [...room.players.values()].filter((p) => p.connected !== false);
      total = present.length;
      acted =
        room.phase === 'VOTE_2'
          ? present.filter((p) => room.confirmedVote2.has(p.id)).length
          : present.filter((p) => room.votes.has(p.id)).length;
    } else if (room.phase === 'PREDICT') {
      const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
      const know = knowRound.isKnowRound(room);
      total = humans.length;
      acted = humans.filter(
        (p) =>
          room.predictions.has(p.id) &&
          room.swingBets.has(p.id) &&
          (!know || !room.knowTargets.has(p.id) || room.knowGuesses.has(p.id)),
      ).length;
    } else if (room.phase === 'SPEAKER_VOTE') {
      const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
      total = humans.length;
      acted = humans.filter((p) => room.speakerVotes.has(p.id)).length;
    } else {
      return false;
    }
    if (total === 0 || acted === total) return false;
    if (acted / total < SOFT_TIMEOUT_THRESHOLD) return false;
    room.phaseExpiresAt = this.now() + SOFT_TIMEOUT_MS;
    return true;
  }
```

Add `SOFT_TIMEOUT_THRESHOLD, SOFT_TIMEOUT_MS` to the existing `import { type GamePhase, PHASE_DURATIONS_MS, ... } from './phases';` block in `rooms.ts`.

- [ ] **Step 10: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/softTimeout.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 11: Wire it into `index.ts`'s six handlers + roster-change refresh**

In `server/src/index.ts`:

`refreshAfterRosterChange` — change the final `else` branch:

```ts
  } else {
    broadcastGameState(code);
  }
```

to:

```ts
  } else {
    if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
    broadcastGameState(code);
  }
```

`player:vote` handler — change:

```ts
    } else {
      broadcastGameState(code); // refresh the count for the host
    }
```

to:

```ts
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the count for the host
    }
```

`player:confirmVote` handler — change:

```ts
    if (rooms.allConfirmed(code)) advanceAndBroadcast(code);
    else broadcastGameState(code);
```

to:

```ts
    if (rooms.allConfirmed(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
```

`player:predict` handler (post-Task-4 shape) — change:

```ts
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the predicted count for the host
    }
```

to:

```ts
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the predicted count for the host
    }
```

`player:swingBet` handler — the identical change (same shape, "swing-bet count" comment).

`player:knowGuess` handler — change:

```ts
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the guessed count
    }
```

to:

```ts
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the guessed count
    }
```

`player:voteSpeaker` handler — change:

```ts
    if (rooms.allSpeakerVoted(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
```

to:

```ts
    if (rooms.allSpeakerVoted(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
```

- [ ] **Step 12: Write an integration test through the socket layer (optional but recommended) — or rely on the unit-level `maybeArmSoftTimeout`/`applyPredictDefaults` coverage above**

If an `index.ts` integration-test harness already exists (check `server/src/**/*.test.ts` for one that spins up `httpServer` + a Socket.IO client), add one end-to-end case: 3 players in VOTE_1, 2 vote, confirm `game:state` broadcasts a non-null `phaseExpiresAt` after the 2nd vote (70% of 3, rounded — 2/3 = 67%, so use 4 players and 3 votes to hit 75% cleanly). Otherwise skip — the unit-level coverage in Steps 1–10 already exercises the real logic; `index.ts`'s job here is just plumbing (`if (x) schedulePhase(code)`), which is simple enough to verify by code review + the manual playtest exit criterion for this phase.

Run: `grep -rl "createServer\|httpServer" server/src/**/*.test.ts 2>/dev/null` to check whether such a harness exists before deciding.

- [ ] **Step 13: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS.

- [ ] **Step 14: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/phases.ts server/src/game/predictions.ts server/src/game/rooms.ts \
  server/src/index.ts server/src/game/__tests__/softTimeout.test.ts
git commit -m "feat(anti-stallo): soft-timeout + auto-default on self-paced phases"
```

---

## Task 6 — Item 0.4: Bot turns 60s→20s + "Ho finito ▶" in the Duello

Two independent, small fixes bundled because they share the same constant
neighborhood and the same `defenseTurns`/`armTurn` machinery: (a) a bot
defender currently holds the stage for a full 60s with nothing happening —
cut to 20s; (b) DUEL_ARGUE currently runs a fixed 45s per turn with no way for
a human to end it early (`finishTurn` explicitly rejects any phase other than
DEFENSE/INTERVENTI) — add the same self-paced "Ho finito ▶" (floor 15s,
reusing `defenseTurns.finishTurn`) the group game already has.

**Files:**
- Modify: `server/src/game/phases.ts:58` (`TURN_BOT_MS`), add `DUEL_TURN_MIN_MS`
- Modify: `server/src/game/defenseTurns.ts` (`finishTurn` accepts `DUEL_ARGUE`)
- Modify: `server/src/game/duel.ts` (`DuelTurn` gains `minEndsAt`/`canFinish`/`startedAt`; `duelTurn(room, now)`)
- Modify: `server/src/game/rooms.ts` (`advanceDuelPhase` arms the per-turn floor; `publicDuelTurn` passes `now`)
- Modify: `client/src/shared/events.ts` (`DuelTurn` type mirror)
- Modify: `client/src/player/views/DuelArgueView.tsx` (finish button)
- Modify: `client/src/player/PlayerApp.tsx` (wire `onFinish`/`canFinishNow`/`minRemaining`/`speakerElapsed` for the duel)
- Test: `server/src/game/__tests__/rooms.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing `defenseTurns.finishTurn(room, playerId, now)`, `defenseTurns.currentSpeakerId(room)` (already handles `DUEL_ARGUE`).
- Produces: `phases.DUEL_TURN_MIN_MS = 15_000`; `duel.DuelTurn.{minEndsAt,canFinish,startedAt}`.

- [ ] **Step 1: Write the failing test for the bot-turn constant**

In `server/src/game/__tests__/rooms.test.ts`, find:

```ts
  it('exposes the floor/cap/bot durations', () => {
    expect([DEFENSE_MIN_MS, INTERVENTO_MIN_MS, DEFENSE_MAX_MS, INTERVENTI_MAX_MS, TURN_BOT_MS])
      .toEqual([30_000, 15_000, 180_000, 90_000, 60_000]);
  });
```

Change the expected array's last value:

```ts
  it('exposes the floor/cap/bot durations', () => {
    expect([DEFENSE_MIN_MS, INTERVENTO_MIN_MS, DEFENSE_MAX_MS, INTERVENTI_MAX_MS, TURN_BOT_MS])
      .toEqual([30_000, 15_000, 180_000, 90_000, 20_000]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "exposes the floor"`
Expected: FAIL — actual is still `60_000`.

- [ ] **Step 3: Change the constant**

In `server/src/game/phases.ts`, change:

```ts
export const TURN_BOT_MS = 60_000;
```

to:

```ts
export const TURN_BOT_MS = 20_000;
```

Add, right below it:

```ts
/** Per-turn floor for a human's DUEL_ARGUE turn — mirrors INTERVENTO_MIN_MS;
 * kept separate so the two can diverge later without cross-affecting. */
export const DUEL_TURN_MIN_MS = 15_000;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "exposes the floor"`
Expected: PASS.

- [ ] **Step 5: Write the failing test — `finishTurn` accepts DUEL_ARGUE**

Add to `server/src/game/__tests__/rooms.test.ts`, near the existing `startDuel` helper's `describe` block (search for `nextDuelPhase(` tests):

```ts
describe('DUEL_ARGUE "Ho finito"', () => {
  it('lets the current arguer finish once the floor has passed, rejects before', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.startGame(code, 3, 'misto', 'duello');
    store.advancePhase(code); // DUEL_PICK
    store.vote(code, 'p1', 'A');
    store.vote(code, 'p2', 'B');
    store.advancePhase(code); // DUEL_REVEAL (disagree)
    store.advancePhase(code); // DUEL_ARGUE, p1's turn
    expect(store.get(code)!.phase).toBe('DUEL_ARGUE');
    expect(store.finishTurn(code, 'p1')).toEqual({
      ok: false,
      error: 'TOO_EARLY',
    });
  });

  it('rejects a finish from the player who is not currently arguing', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.startGame(code, 3, 'misto', 'duello');
    store.advancePhase(code);
    store.vote(code, 'p1', 'A');
    store.vote(code, 'p2', 'B');
    store.advancePhase(code);
    store.advancePhase(code); // DUEL_ARGUE, p1's turn
    expect(store.finishTurn(code, 'p2')).toEqual({ ok: false, error: 'NOT_SPEAKER' });
  });
});
```

(`makeFixtureDeck` — reuse the file's existing fixture/helper at the top; if `startDuel` there uses a fixed room code, keep this new `describe` self-contained using `store.create()` directly as shown, which does not depend on that helper.)

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "DUEL_ARGUE"`
Expected: FAIL — `finishTurn` currently returns `{ ok: false, error: 'NOT_FINISHING_PHASE' }` for DUEL_ARGUE regardless of who calls it, since the phase isn't in its allowlist.

- [ ] **Step 7: Update `finishTurn`**

In `server/src/game/defenseTurns.ts`, change:

```ts
export function finishTurn(room: Room, playerId: string, now: number): FinishTurnResult {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') {
    return { ok: false, error: 'NOT_FINISHING_PHASE' };
  }
```

to:

```ts
export function finishTurn(room: Room, playerId: string, now: number): FinishTurnResult {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI' && room.phase !== 'DUEL_ARGUE') {
    return { ok: false, error: 'NOT_FINISHING_PHASE' };
  }
```

- [ ] **Step 8: Arm the per-turn floor in `advanceDuelPhase`**

In `server/src/game/rooms.ts`, in `advanceDuelPhase`, change:

```ts
  private advanceDuelPhase(room: Room): AdvancePhaseResult {
    if (room.phase === 'DUEL_ARGUE' && room.duelTurnIndex < duelPlayers(room).length - 1) {
      room.duelTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DUEL_ARGUE');
      return { ok: true, room };
    }
    const agreed = room.phase === 'DUEL_REVEAL' ? duelAgreed(room) : false;
    const t = nextDuelPhase(room.phase, room.dilemmaIndex, room.dilemmaCount ?? 0, agreed);
    room.phase = t.phase;
    room.dilemmaIndex = t.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(t.phase);
    if (t.phase === 'DUEL_PICK') {
      room.currentDilemma = room.deck?.draw() ?? null;
      room.votes.clear();
      room.votes1.clear();
      room.duelTurnIndex = 0;
    }
    if (t.phase === 'DUEL_REPICK') {
      room.votes1 = new Map(room.votes);
    }
    if (t.phase === 'DUEL_RESULT') {
      if (room.votes1.size === 0) room.votes1 = new Map(room.votes);
      recordDuelResult(room);
    }
    return { ok: true, room };
  }
```

to:

```ts
  private advanceDuelPhase(room: Room): AdvancePhaseResult {
    if (room.phase === 'DUEL_ARGUE' && room.duelTurnIndex < duelPlayers(room).length - 1) {
      room.duelTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DUEL_ARGUE');
      room.turnStartedAt = this.now();
      room.turnMinEndsAt = this.now() + DUEL_TURN_MIN_MS;
      return { ok: true, room };
    }
    const agreed = room.phase === 'DUEL_REVEAL' ? duelAgreed(room) : false;
    const t = nextDuelPhase(room.phase, room.dilemmaIndex, room.dilemmaCount ?? 0, agreed);
    room.phase = t.phase;
    room.dilemmaIndex = t.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(t.phase);
    if (t.phase === 'DUEL_PICK') {
      room.currentDilemma = room.deck?.draw() ?? null;
      room.votes.clear();
      room.votes1.clear();
      room.duelTurnIndex = 0;
    }
    if (t.phase === 'DUEL_ARGUE') {
      room.turnStartedAt = this.now();
      room.turnMinEndsAt = this.now() + DUEL_TURN_MIN_MS;
    }
    if (t.phase === 'DUEL_REPICK') {
      room.votes1 = new Map(room.votes);
    }
    if (t.phase === 'DUEL_RESULT') {
      if (room.votes1.size === 0) room.votes1 = new Map(room.votes);
      recordDuelResult(room);
    }
    return { ok: true, room };
  }
```

Add `DUEL_TURN_MIN_MS` to the existing `phases` import block in `rooms.ts`.

- [ ] **Step 9: Run to verify the two new rooms.test.ts cases pass**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "DUEL_ARGUE"`
Expected: PASS.

- [ ] **Step 10: Extend `DuelTurn` + `duelTurn()` in `duel.ts`**

In `server/src/game/duel.ts`, change:

```ts
export interface DuelTurn {
  speaker: DuelSpeaker | null;
  turn: number;
  totalTurns: number;
}
```

to:

```ts
export interface DuelTurn {
  speaker: DuelSpeaker | null;
  turn: number;
  totalTurns: number;
  /** When the current turn's "Ho finito" floor lifts; null if there is none. */
  minEndsAt: number | null;
  /** Whether the current arguer may end their turn early right now. */
  canFinish: boolean;
  /** When the current turn started, for the client's count-up display. */
  startedAt: number | null;
}
```

Change:

```ts
export function duelTurn(room: Room): DuelTurn | null {
  if (room.phase !== 'DUEL_ARGUE') return null;
  const players = duelPlayers(room);
  const total = players.length;
  const cur = players[room.duelTurnIndex];
  const side = cur ? room.votes.get(cur.id) ?? null : null;
  return {
    speaker: cur && side ? { id: cur.id, nickname: cur.nickname, side } : null,
    turn: total === 0 ? 0 : room.duelTurnIndex + 1,
    totalTurns: total,
  };
}
```

to:

```ts
export function duelTurn(room: Room, now: number): DuelTurn | null {
  if (room.phase !== 'DUEL_ARGUE') return null;
  const players = duelPlayers(room);
  const total = players.length;
  const cur = players[room.duelTurnIndex];
  const side = cur ? room.votes.get(cur.id) ?? null : null;
  return {
    speaker: cur && side ? { id: cur.id, nickname: cur.nickname, side } : null,
    turn: total === 0 ? 0 : room.duelTurnIndex + 1,
    totalTurns: total,
    minEndsAt: room.turnMinEndsAt,
    canFinish: room.turnMinEndsAt == null || now >= room.turnMinEndsAt,
    startedAt: room.turnStartedAt,
  };
}
```

- [ ] **Step 11: Update `publicDuelTurn` in `rooms.ts`**

Change:

```ts
  publicDuelTurn(code: string) {
    const room = this.rooms.get(code);
    return room ? duelTurn(room) : null;
  }
```

to:

```ts
  publicDuelTurn(code: string) {
    const room = this.rooms.get(code);
    return room ? duelTurn(room, this.now()) : null;
  }
```

- [ ] **Step 12: Run the full server suite + typecheck**

Run: `npm --prefix server test && npm run typecheck`
Expected: PASS (typecheck will catch any other internal caller of `duelTurn(room)` missing the new `now` arg — there should be none besides `publicDuelTurn`, per the earlier grep).

- [ ] **Step 13: Extend the client `DuelTurn` type**

In `client/src/shared/events.ts`, change:

```ts
export interface DuelTurn {
  speaker: { id: string; nickname: string; side: VoteChoice } | null;
  turn: number;
  totalTurns: number;
}
```

to:

```ts
export interface DuelTurn {
  speaker: { id: string; nickname: string; side: VoteChoice } | null;
  turn: number;
  totalTurns: number;
  minEndsAt: number | null;
  canFinish: boolean;
  startedAt: number | null;
}
```

- [ ] **Step 14: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx`, near "shows who is arguing for a spectator at DUEL_ARGUE":

```tsx
  it('shows the finish affordance once the floor lifts at DUEL_ARGUE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DUEL_ARGUE',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        mode: 'duello',
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duelTurn: {
          speaker: { id: 'p1', nickname: 'Alice', side: 'A' },
          turn: 1,
          totalTurns: 2,
          minEndsAt: null,
          canFinish: true,
          startedAt: Date.now(),
        },
        leaderId: null,
      });
    });
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeEnabled();
  });

  it('locks the finish button before the floor lifts at DUEL_ARGUE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DUEL_ARGUE',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        mode: 'duello',
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duelTurn: {
          speaker: { id: 'p1', nickname: 'Alice', side: 'A' },
          turn: 1,
          totalTurns: 2,
          minEndsAt: Date.now() + 15_000,
          canFinish: false,
          startedAt: Date.now(),
        },
        leaderId: null,
      });
    });
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeDisabled();
  });
```

- [ ] **Step 15: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "DUEL_ARGUE"`
Expected: FAIL — no "Ho finito" button is rendered in `DuelArgueView` at all yet.

- [ ] **Step 16: Add the finish button to `DuelArgueView.tsx`**

Add props to `DuelArgueViewProps`:

```ts
interface DuelArgueViewProps {
  speaker: DuelSpeaker | null | undefined;
  dilemma: DuelDilemma | null | undefined;
  playerId: string | null;
  remaining: number | null;
  canFinishNow: boolean;
  minRemaining: number | null;
  speakerElapsed: number | null;
  onFinish: () => void;
  onReact: (emoji: Reaction) => void;
  skipButton: ReactNode;
}
```

Import `Button` and `formatMSS`:

```ts
import { formatMSS } from '../../shared/time';
import { Button } from '../../shared/ui';
```

Destructure the new props and render the finish button + elapsed time in the `myTurn` branch:

```tsx
export default function DuelArgueView({
  speaker,
  dilemma,
  playerId,
  remaining,
  canFinishNow,
  minRemaining,
  speakerElapsed,
  onFinish,
  onReact,
  skipButton,
}: DuelArgueViewProps) {
  const myTurn = speaker != null && speaker.id === playerId;
  const sideOption = speaker
    ? speaker.side === 'A'
      ? dilemma?.optionA
      : dilemma?.optionB
    : undefined;
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DUEL_ARGUE}</h1>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {myTurn ? (
        <>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
          {dilemma && (
            <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
              {dilemma.text}
            </p>
          )}
          <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
            Argomenta <strong>{speaker.side}</strong>
            {sideOption ? `: ${sideOption}` : ''}
          </p>
          <div
            aria-label="Tempo trascorso"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMSS(speakerElapsed ?? 0)}
          </div>
          <Button variant="primary" size="lg" onClick={onFinish} disabled={!canFinishNow}>
            Ho finito ▶
          </Button>
          {!canFinishNow && (
            <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>
              Parla ancora {minRemaining ?? ''}s prima di poter passare
            </p>
          )}
        </>
      ) : speaker ? (
        <>
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            Sta argomentando <strong>{speaker.nickname}</strong> 🎤
          </p>
          <ReactionBar onReact={onReact} />
        </>
      ) : (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>Guarda lo schermo condiviso.</p>
      )}
      {skipButton}
    </main>
  );
}
```

- [ ] **Step 17: Wire `PlayerApp.tsx`**

Near the existing `minRemaining`/`canFinishNow`/`speakerElapsed` computations (line ~330-333), add duel equivalents:

```ts
  const duelMinRemaining = useCountdown(game?.duelTurn?.minEndsAt ?? null);
  const duelCanFinishNow = game?.duelTurn?.minEndsAt == null || (duelMinRemaining ?? 0) <= 0;
  const duelSpeakerElapsed = useElapsed(game?.duelTurn?.startedAt ?? null);
```

Pass them to `DuelArgueView` (line ~654-665):

```tsx
      <DuelArgueView
        speaker={game?.duelTurn?.speaker}
        dilemma={game?.dilemma}
        playerId={playerId}
        remaining={remaining}
        canFinishNow={duelCanFinishNow}
        minRemaining={duelMinRemaining}
        speakerElapsed={duelSpeakerElapsed}
        onFinish={sendFinish}
        onReact={sendReaction}
        skipButton={skipButton}
      />
```

- [ ] **Step 18: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 19: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/phases.ts server/src/game/defenseTurns.ts server/src/game/duel.ts \
  server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts \
  client/src/shared/events.ts client/src/player/views/DuelArgueView.tsx \
  client/src/player/PlayerApp.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(duello): 20s bot turns + self-paced 'Ho finito' in DUEL_ARGUE"
```

---

## Task 7 — Item 0.7: 2-tap "Salta ▶" confirm on secret-vote phases

The leader's "Salta ▶" force-advances immediately on a single tap. On a
DEFENSE/INTERVENTI/DUEL_ARGUE turn that's fine — it just ends someone's
monologue a little early. But on VOTE_1/VOTE_2/PREDICT/SPEAKER_VOTE/
DUEL_PICK/DUEL_REPICK, a single accidental tap can silently cut off another
player's still-forming secret input. Require a second tap to confirm on those
phases only.

**Files:**
- Modify: `client/src/player/PlayerApp.tsx:576-597` (`skipButton`)
- Test: `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing `advance()` (`getSocket().emit(SocketEvents.LeaderAdvancePhase)`), `phase`, `isLeader`. No change to their signatures.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('requires a second tap of "Salta" during a secret-vote phase (VOTE_1)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p1', // I'm the leader
      });
    });
    const skip = screen.getByRole('button', { name: /salta/i });
    fireEvent.click(skip);
    expect(emitSpy).not.toHaveBeenCalledWith('leader:advancePhase');
    fireEvent.click(screen.getByRole('button', { name: /salta/i })); // 2nd tap, now confirming
    expect(emitSpy).toHaveBeenCalledWith('leader:advancePhase');
  });

  it('advances on a single tap of "Salta" during a speaking-turn phase (DEFENSE)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /salta/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:advancePhase');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "Salta"`
Expected: The first test FAILs (today's single-tap Salta emits immediately, so `not.toHaveBeenCalledWith` after the 1st click is false). The second test already PASSes (existing behavior) — that's fine, it documents the behavior this task must not break.

- [ ] **Step 3: Implement the 2-tap gate**

In `client/src/player/PlayerApp.tsx`, add a new state near the other UI-confirmation states (e.g. next to `confirmingLeave`, line ~156):

```ts
  // "Salta ▶" needs a 2nd tap during a secret-vote phase (VOTE_1/VOTE_2/
  // PREDICT/SPEAKER_VOTE/DUEL_PICK/DUEL_REPICK) so an impatient leader can't
  // silently cut off someone else's still-forming vote with one stray tap.
  const [confirmingSkip, setConfirmingSkip] = useState(false);
```

Reset it whenever the phase changes (add a small effect near the other phase-keyed resets, e.g. after the `handRaised`/`raiseHandError` reset effect):

```ts
  useEffect(() => {
    setConfirmingSkip(false);
  }, [phase]);
```

Change the `skipButton` block (lines ~576-597):

```ts
  // Phases that run a server-side countdown the leader may skip (everything past
  // the lobby except the terminal award/duel screens and the leader-paced cards:
  // the percorso recap + the four storia narrative beats get a "Continua ▶" inside
  // their own card instead of a bottom "Salta ▶").
  const phaseHasTimer = (p: GameStatePayload['phase']) =>
    p !== 'LOBBY' &&
    p !== 'FINAL_AWARDS' &&
    p !== 'FINAL_DUEL' &&
    p !== 'TAPPA_RECAP' &&
    p !== 'STORY_INTRO' &&
    p !== 'SCENE_INTRO' &&
    p !== 'SCENE_CONSEQUENCE' &&
    p !== 'STORY_EPILOGUE';

  // Phases where skipping cuts off OTHER players' still-secret input, so
  // "Salta ▶" needs a confirming 2nd tap instead of firing immediately.
  const isSecretVotePhase = (p: GameStatePayload['phase']) =>
    p === 'VOTE_1' ||
    p === 'VOTE_2' ||
    p === 'PREDICT' ||
    p === 'SPEAKER_VOTE' ||
    p === 'DUEL_PICK' ||
    p === 'DUEL_REPICK';

  // The leader's "skip the rest of this phase" button — only shown to the leader
  // during a phase that has a countdown. Rendered in each in-game branch.
  const skipButton =
    isLeader && phaseHasTimer(phase) ? (
      isSecretVotePhase(phase) ? (
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmingSkip) {
              setConfirmingSkip(false);
              advance();
            } else {
              setConfirmingSkip(true);
            }
          }}
        >
          {confirmingSkip ? 'Sicuro? Tocca di nuovo ▶' : 'Salta ▶'}
        </Button>
      ) : (
        <Button variant="ghost" onClick={advance}>
          Salta ▶
        </Button>
      )
    ) : null;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "Salta"`
Expected: PASS, both tests.

- [ ] **Step 5: Run the full client suite**

Run: `npm --prefix client test` (or the repo-root `npm test` if it covers both workspaces)
Expected: PASS.

- [ ] **Step 6: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add client/src/player/PlayerApp.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(salta): require a 2nd tap to skip a secret-vote phase in progress"
```

---

## Task 8 — Item 0.2: Show who's missing

Replace the bare "Hanno votato 2/3" counter with "Aspettiamo Marco e
Giulia…" wherever knowing *who* hasn't acted can't leak *what* they'd choose
(true for every voting/prediction phase — the aggregate split is never shown
mid-phase, only counts). Scoped to `VoteView` (VOTE_1's voted-count line,
VOTE_2's confirmed-count line) and `PredictView` (the predicted-count line)
per the spec.

**Files:**
- Modify: `server/src/game/voting.ts` (new `missingVoters`)
- Modify: `server/src/game/rooms.ts` (new `RoomStore.missingVoters` delegate; reuse `predictProgress` from Task 4 for the PREDICT side)
- Modify: `server/src/index.ts` (`gameStatePayload`: add `missingVoters`, `missingPredictors`)
- Modify: `client/src/shared/events.ts` (`GameStatePayload` gains both fields)
- Modify: `client/src/player/views/layout.ts` (new `formatWaitingList` helper, shared by both views)
- Modify: `client/src/player/views/VoteView.tsx`, `client/src/player/views/PredictView.tsx`
- Modify: `client/src/player/PlayerApp.tsx` (pass the two new fields through)
- Test: `server/src/game/__tests__/rooms.test.ts` (or a new `__tests__/voting.test.ts`), `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: `predictions.predictProgress` (Task 4) for the PREDICT missing-list; `voting.isVotingPhase` (existing).
- Produces: `voting.missingVoters(room): string[] | null`; `GameStatePayload.missingVoters: string[] | null`, `GameStatePayload.missingPredictors: string[] | null`.

- [ ] **Step 1: Write the failing server test**

Create `server/src/game/__tests__/voting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';

describe('missingVoters', () => {
  it('lists connected players who have not voted yet in VOTE_1', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    store.join(code, 'p3', 'Luca');
    store.get(code)!.phase = 'VOTE_1';
    store.vote(code, 'p3', 'A');
    expect(store.missingVoters(code)!.sort()).toEqual(['Giulia', 'Marco']);
  });

  it('checks confirmedVote2, not votes, during VOTE_2', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.phase = 'VOTE_2';
    room.votes.set('p1', 'A'); // pre-filled from VOTE_1, not yet confirmed
    room.votes.set('p2', 'B');
    room.confirmedVote2.add('p2');
    expect(store.missingVoters(code)).toEqual(['Marco']);
  });

  it('excludes a disconnected player (they are not "missing" — they are absent)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.phase = 'VOTE_1';
    room.players.get('p2')!.connected = false;
    expect(store.missingVoters(code)).toEqual(['Marco']);
  });

  it('is null outside a voting phase', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    expect(store.missingVoters(code)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/voting.test.ts`
Expected: FAIL — `store.missingVoters` doesn't exist.

- [ ] **Step 3: Implement `voting.missingVoters`**

In `server/src/game/voting.ts`, add near `allVoted`/`allConfirmed`:

```ts
/**
 * Nicknames of connected players still missing their action this voting
 * phase — VOTE_1/DUEL_PICK: haven't cast a vote yet; VOTE_2/DUEL_REPICK:
 * haven't confirmed (their VOTE_1 choice already carried over as the
 * default). Never reveals WHICH choice, only presence — safe to broadcast.
 * Null outside a voting phase.
 */
export function missingVoters(room: Room): string[] | null {
  if (!isVotingPhase(room.phase)) return null;
  const present = [...room.players.values()].filter((p) => p.connected !== false);
  const isConfirmPhase = room.phase === 'VOTE_2' || room.phase === 'DUEL_REPICK';
  return present
    .filter((p) => (isConfirmPhase ? !room.confirmedVote2.has(p.id) : !room.votes.has(p.id)))
    .map((p) => p.nickname);
}
```

Add the `RoomStore` delegate in `rooms.ts` (near `publicSplit`):

```ts
  /** Nicknames of connected players still missing their vote/confirmation
   * this voting phase; null outside one. Never reveals which choice. */
  missingVoters(code: string): string[] | null {
    const room = this.rooms.get(code);
    return room ? voting.missingVoters(room) : null;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/voting.test.ts`
Expected: PASS.

- [ ] **Step 5: Add both fields to `gameStatePayload`**

In `server/src/index.ts`, in `gameStatePayload(room)`, add near `votedCount`/`predictedCount`:

```ts
    // Nicknames of connected players still missing their action this voting
    // phase (VOTE_1/VOTE_2/DUEL_PICK/DUEL_REPICK); null otherwise. Never
    // reveals WHICH choice — presence only.
    missingVoters: rooms.missingVoters(room.code),
    // Nicknames of connected humans still missing a PREDICT action
    // (prediction, swing bet, or — in the know round — their guess); null
    // outside PREDICT.
    missingPredictors: rooms.predictProgress(room.code)?.missingNicknames ?? null,
```

- [ ] **Step 6: Add both fields to the client `GameStatePayload`**

In `client/src/shared/events.ts`, add next to `votedCount`/`predictedCount`:

```ts
  /**
   * Nicknames of connected players still missing their vote/confirmation
   * this voting phase (VOTE_1/VOTE_2/DUEL_PICK/DUEL_REPICK); null otherwise.
   * Never reveals which choice — presence only.
   */
  missingVoters: string[] | null;
  /**
   * Nicknames of connected humans still missing a PREDICT-phase action
   * (prediction, swing bet, or — in the know round — their guess); null
   * outside PREDICT.
   */
  missingPredictors: string[] | null;
```

- [ ] **Step 7: Add the shared formatting helper**

In `client/src/player/views/layout.ts`, add:

```ts
/** "Marco" / "Marco e Giulia" / "Marco, Giulia e Luca" — a short, friendly
 * waiting-on list; never used for more than a handful of names (MAX_PLAYERS
 * is 8), so no truncation logic is needed yet. */
export function formatWaitingList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
```

- [ ] **Step 8: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx`, near "shows group voting progress on the phone at VOTE_1":

```tsx
  it('shows who is missing instead of the counter at VOTE_1', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 2,
        missingVoters: ['Marco', 'Giulia'],
        leaderId: null,
      });
    });
    expect(screen.getByText(/aspettiamo marco e giulia/i)).toBeInTheDocument();
    expect(screen.queryByText(/hanno votato/i)).toBeNull();
  });

  it('falls back to the counter at VOTE_1 when nobody is missing yet (list not sent)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 2,
        missingVoters: null,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hanno votato 2\/3/i)).toBeInTheDocument();
  });

  it('shows who is missing instead of the counter at PREDICT', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PREDICT',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        predictedCount: 1,
        missingPredictors: ['Marco'],
        leaderId: null,
      });
    });
    expect(screen.getByText(/aspettiamo marco/i)).toBeInTheDocument();
  });
```

Note: the "3" in `/hanno votato 2\/3/i` above assumes `players.length === 3` — reuse the same `lobby:update` setup as the existing "shows group voting progress" test (3 players) if the test file's default player-count fixture differs; adjust the literal to match whatever `players` array you emit, or add a `lobby:update` for `[Alice, Marco, Giulia]` right before the `game:state` emit for that test.

- [ ] **Step 9: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "missing"`
Expected: FAIL — `VoteView`/`PredictView` don't accept or render these props yet.

- [ ] **Step 10: Wire `VoteView.tsx`**

Add `missingVoters: string[] | null;` to `VoteViewProps` and the destructure. Import the helper:

```ts
import { wrap, formatWaitingList } from './layout';
```

Change the VOTE_1 counter line:

```tsx
      {(phase === 'VOTE_1' || phase === 'DUEL_PICK') && (
        <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
          Hanno votato {votedCount}/{playerCount}
        </p>
      )}
```

to:

```tsx
      {(phase === 'VOTE_1' || phase === 'DUEL_PICK') &&
        (missingVoters && missingVoters.length > 0 ? (
          <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
            Aspettiamo {formatWaitingList(missingVoters)}…
          </p>
        ) : (
          <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
            Hanno votato {votedCount}/{playerCount}
          </p>
        ))}
```

And the VOTE_2 "waiting for others" line:

```tsx
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
              Aspettiamo gli altri… {confirmedCount}/{playerCount}
            </p>
```

to:

```tsx
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
              {missingVoters && missingVoters.length > 0
                ? `Aspettiamo ${formatWaitingList(missingVoters)}…`
                : `Aspettiamo gli altri… ${confirmedCount}/${playerCount}`}
            </p>
```

- [ ] **Step 11: Wire `PredictView.tsx`**

Add `missingPredictors: string[] | null;` to `PredictViewProps` and the destructure. Import the helper:

```ts
import { wrap, formatWaitingList } from './layout';
```

Change:

```tsx
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        Hanno pronosticato {predictedCount}/{playerCount}
      </p>
```

to:

```tsx
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        {missingPredictors && missingPredictors.length > 0
          ? `Aspettiamo ${formatWaitingList(missingPredictors)}…`
          : `Hanno pronosticato ${predictedCount}/${playerCount}`}
      </p>
```

- [ ] **Step 12: Wire `PlayerApp.tsx`**

In the `VoteView` render (VOTE_1/VOTE_2/DUEL_PICK/DUEL_REPICK branch), add:

```tsx
        missingVoters={game?.missingVoters ?? null}
```

In the `PredictView` render, add:

```tsx
        missingPredictors={game?.missingPredictors ?? null}
```

- [ ] **Step 13: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 14: Run the full test suite (both workspaces)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 15: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/voting.ts server/src/game/rooms.ts server/src/index.ts \
  server/src/game/__tests__/voting.test.ts client/src/shared/events.ts \
  client/src/player/views/layout.ts client/src/player/views/VoteView.tsx \
  client/src/player/views/PredictView.tsx client/src/player/PlayerApp.tsx \
  client/src/player/PlayerApp.test.tsx
git commit -m "feat(anti-stallo): show who's missing instead of a bare count"
```

---

## Exit criteria (from the spec)

Play an 8-player game with one phone "dead" (never touched) at every phase:
VOTE_1, VOTE_2, PREDICT, SPEAKER_VOTE, a DEFENSE turn, and a disconnect during
the leader's turn. Verify:
- No stall lasts more than ~60s (soft-timeout + auto-default) anywhere.
- The stage is never occupied by the dead phone (defender selection skips it; if picked before going dark, its turn caps at 20s like a bot).
- Leadership always lands on a *reachable* phone if the leader drops.
- The INTERVENTI queue never exceeds 3 mini-turns per defense.
- The leader's "Salta ▶" needs 2 taps during any secret-vote phase, 1 tap otherwise.
- The "who's missing" list replaces the raw counter on VOTE_1/VOTE_2/PREDICT once it's populated.
- The Duello never leaves a human stuck reading a 45s timer with nothing to do — bots would be capped at 20s, and a human can "Ho finito ▶" after 15s.

Once this playtest is clean, move on to FASE 1 (reveal teatrale + rematch) per
`docs/superpowers/specs/2026-07-07-party-game-perfetto-piano-design.md`.
