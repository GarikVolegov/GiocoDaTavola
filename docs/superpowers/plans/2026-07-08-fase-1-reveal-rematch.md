# FASE 1 — Incassare il divertimento: reveal teatrale + rematch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop cutting the payoff short. Today PHASE_RESULTS dumps the swing,
the attribution, and every private result on screen at once for a flat 8s;
SPLIT_REVEAL has no suspense; a defender's applause vanishes the instant their
turn ends; a player-written dilemma's authorship is silently thrown away;
DEFENSE listeners can't see what's being argued; countdowns are silent on the
phone; and a finished game is a dead end requiring a full re-scan of the QR
code to play again.

**Architecture:** Seven changes layered on the existing state machine
(`server/src/game/*`) and the phone/host clients (`client/src/player/*`,
`client/src/host/*`, `client/src/shared/*`). The centerpiece (Task 6) reuses
the *existing* `leader:advancePhase` socket event and the *existing*
per-phase-timer machinery (`schedulePhase`/`advanceAndBroadcast`) to turn
PHASE_RESULTS into 2–3 leader-paced "beats" — no new socket events, no new
`GamePhase` values. The pre-reveal countdown (part of Task 6) needs **no
server change at all**: it's a purely client-side, non-authoritative
theatrical delay (the actual split data is already sitting in the payload;
showing "3…2…1…" before rendering it is cosmetic). Confetti (`Celebration`)
and the Web-Audio SFX module (`client/src/host/audio/`) already exist and are
extended, not rebuilt.

**Tech Stack:** Node + Express + Socket.IO server (TypeScript CommonJS, tsx in
dev), React + Vite client (TypeScript ESM), Vitest for both.

## Global Constraints

- TDD: write the failing test before the implementation, for every step that touches behavior.
- Full gate (`npm run typecheck && npm run lint && npm test && npm run build`) must stay green before every commit.
- Never send an individual secret vote/prediction/guess/accusation to the host or other players — only aggregates. This plan adds no new secret data; the closest new field (`dilemmaAuthor`, `lastTurnApplause`) is public-safe by construction (an author choosing to submit a dilemma, and reactions, are already public acts).
- Timers are server-authoritative for anything that affects game *state* (phase transitions); the SPLIT_REVEAL lead-in countdown is the one deliberate exception — it's purely decorative and never gates or blocks the underlying vote data, which the server already computed and sent.
- No `any` (lint error). Prefix intentionally-unused vars/args with `_`.
- Keep server (CJS) and client (ESM) module systems separate.
- Commit after each task with a message describing the fix, not the task number.
- Push to the remote at the end of the whole plan (per the user's standing rule), not after every task.
- Execute tasks in the order given: Task 7 (ribaltone naming) depends on Task 6's beat structure existing.

---

## Task 1 — Item 1.6: Vista pubblico ricca durante DEFENSE

A DEFENSE listener (anyone except the current speaker) sees only "Sta
parlando **Bea** 🎤" — not the dilemma text or which side Bea is defending,
even though both are already sitting in props the component already
destructures (`dilemma`, `speaker.side`, and the already-computed
`sideOption`). Pure rendering gap, zero data plumbing.

**Files:**
- Modify: `client/src/player/views/DefenseView.tsx`
- Test: `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing `DefenseViewProps` (`dilemma`, `defense`) — no signature change.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `client/src/player/PlayerApp.test.tsx`, near "shows the speaker + raise-hand for a spectator at DEFENSE":

```tsx
  it('shows the dilemma and defended side to a listener (not just the speaker) at DEFENSE', () => {
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
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        leaderId: null,
      });
    });
    expect(screen.getByText('Mare o montagna?')).toBeInTheDocument();
    expect(screen.getByText(/difendendo/i)).toBeInTheDocument();
    expect(screen.getByText('Mare')).toBeInTheDocument(); // the side A option text
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "listener"`
Expected: FAIL — none of that text renders for a non-speaking listener today.

- [ ] **Step 3: Add the dilemma + defended-side lines to the listener branch**

In `client/src/player/views/DefenseView.tsx`, find the listener (`else`) branch — the one starting `) : (` right after the `speaker == null && phase === 'DEFENSE'` branch, containing:

```tsx
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            {phase === 'INTERVENTI' ? (
              <>Interviene <strong>{d?.intervenor?.nickname ?? '…'}</strong> 🙋</>
            ) : (
              <>Sta parlando <strong>{speaker?.nickname ?? '…'}</strong> 🎤</>
            )}
          </p>
```

Add right after it (still inside the same fragment, before the raise-hand button):

```tsx
          {phase === 'DEFENSE' && speaker && (
            <>
              {dilemma && (
                <p style={{ fontSize: '0.95rem', opacity: 0.75, margin: 0, maxWidth: '22rem' }}>
                  {dilemma.text}
                </p>
              )}
              <p style={{ fontSize: '1rem', opacity: 0.9, margin: 0 }}>
                Sta difendendo <strong>{speaker.side}</strong>
                {sideOption ? `: ${sideOption}` : ''}
              </p>
            </>
          )}
```

(`sideOption` is already computed at the top of the component — reuse it, don't recompute.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add client/src/player/views/DefenseView.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(defense): show the dilemma + defended side to listeners, not just the speaker"
```

---

## Task 2 — Item 1.7: Vibrazione countdown

The last 5 seconds of *any* phase timer should buzz every phone once per
second (mirroring the host's existing `timerWarn` SFX, which already ticks in
the final 5s via `shouldWarnAt` — the phone side just has no haptic
equivalent). `remaining` is already computed once, generically, at the top of
`PlayerApp.tsx`; `buzz()` already exists. This is one small effect.

**Files:**
- Modify: `client/src/player/PlayerApp.tsx`
- Test: `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing local `buzz(pattern: number | number[]): void`, existing `remaining` (from `useCountdown(game?.phaseExpiresAt)`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

`buzz()` calls `navigator.vibrate` directly — the test spies on that. Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('buzzes once per second during the last 5s of any phase timer', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true });
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'SPLIT_REVEAL',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: Date.now() + 5_000, // already inside the last 5s
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(vibrateSpy).toHaveBeenCalled();
  });
```

Note: if `useCountdown` is driven by a `setInterval` internally, this test may need `vi.useFakeTimers()` / `act(() => vi.advanceTimersByTime(...))` around the tick — check how existing `remaining`-dependent tests in this file (e.g. the DEFENSE floor tests) drive the countdown, and mirror that exact pattern instead of guessing.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "buzzes once per second"`
Expected: FAIL — no vibrate call happens today outside the turn-start/hand-raise buzzes.

- [ ] **Step 3: Add the generic countdown-buzz effect**

In `client/src/player/PlayerApp.tsx`, find:

```ts
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);
```

Add right after it:

```ts
  // The last 5s of ANY phase timer buzz every phone once per second — mirrors
  // the host's audio timerWarn cue, which already ticks in the same window.
  useEffect(() => {
    if (remaining != null && remaining >= 1 && remaining <= 5) buzz(20);
  }, [remaining]);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add client/src/player/PlayerApp.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(countdown): buzz every phone in the last 5s of any phase timer"
```

---

## Task 3 — Item 1.1: Rematch a un tap

At FINAL_AWARDS/FINAL_DUEL there's no way back except leaving the room and
re-scanning the QR code. Add a "Giocate ancora ▶" button (leader-only) that
returns the room to LOBBY with the same roster/code/leader, remembering this
game's dilemmas so the next game's deck excludes them.

**Files:**
- Modify: `server/src/game/rooms.ts` (new `Room.excludeDilemmaIds` field, new `RoomStore.rematch()`, `startGame()` consumes+clears the exclude set)
- Modify: `server/src/index.ts` (new `leader:rematch` handler)
- Modify: `client/src/shared/events.ts` (new `SocketEvents.LeaderRematch`)
- Modify: `client/src/player/PlayerApp.tsx` (wire the emit + `isLeader`)
- Modify: `client/src/player/views/StatusView.tsx` (the button, at FINAL_AWARDS and FINAL_DUEL)
- Test: `server/src/game/__tests__/rooms.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: nothing from other FASE 1 tasks.
- Produces: `RoomStore.rematch(code): { ok: true; room: Room } | { ok: false; error: 'ROOM_NOT_FOUND' | 'NOT_FINISHED' }`. `leader:rematch` socket event (no payload).

- [ ] **Step 1: Write the failing test — rematch resets to LOBBY, keeps the roster, excludes played dilemmas**

Add to `server/src/game/__tests__/rooms.test.ts` (a small deterministic fixture deck, mirroring the file's existing `makeFixtureDeck` pattern — reuse it if already declared at file scope, otherwise declare locally):

```ts
describe('rematch()', () => {
  it('rejects from anywhere except FINAL_AWARDS/FINAL_DUEL', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.rematch(code)).toEqual({ ok: false, error: 'NOT_FINISHED' });
  });

  it('rejects an unknown room', () => {
    const store = new RoomStore();
    expect(store.rematch('ZZZZ')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('returns to LOBBY keeping the same roster + leader + code, and excludes this game\'s dilemmas from the next deck', () => {
    const fixture: Dilemma[] = Array.from({ length: 4 }, (_, i) => ({
      id: `d${i + 1}`,
      text: `Dilemma ${i + 1}?`,
      optionA: `A${i + 1}`,
      optionB: `B${i + 1}`,
      register: 'vita' as const,
    }));
    const makeFixtureDeck = (_r: ContentRegister) => new Deck(fixture, () => 0);
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Cid');
    store.setLeader(code, 'p1');
    store.startGame(code, 3);
    // Walk the whole game to FINAL_AWARDS (3 rounds), voting the same each time.
    let guard = 0;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && guard++ < 60) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        for (const id of ['p1', 'p2', 'p3']) store.vote(code, id, 'A');
      }
    }
    expect(store.get(code)!.phase).toBe('FINAL_AWARDS');
    const playedIds = store.get(code)!.plannedDilemmas.map((d) => d.id);
    expect(playedIds).toEqual(['d1', 'd2', 'd3']); // rng=()=>0 walks the fixture in order

    const result = store.rematch(code);
    expect(result.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.phase).toBe('LOBBY');
    expect(room.code).toBe(code);
    expect(room.leaderId).toBe('p1');
    expect([...room.players.keys()].sort()).toEqual(['p1', 'p2', 'p3']);

    // Start a second game with the SAME fixture deck (4 dilemmas, 3 already
    // played) — the deck must skip d1-d3 and draw only the untouched d4.
    store.startGame(code, 3);
    expect(store.get(code)!.plannedDilemmas.map((d) => d.id)).toEqual(['d4']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "rematch"`
Expected: FAIL — `store.rematch` doesn't exist yet (TypeError).

- [ ] **Step 3: Add the `excludeDilemmaIds` field**

In `server/src/game/rooms.ts`, add to the `Room` interface (near `submittedDilemmas`/`dilemmaAuthors`):

```ts
  /** Dilemma ids to exclude from the NEXT deck build — populated by rematch()
   * from the just-finished game's plannedDilemmas, consumed and cleared by
   * startGame(). Empty outside a rematch flow. */
  excludeDilemmaIds: Set<string>;
```

Add to `create()`'s room literal (near `dilemmaAuthors: new Map(),`):

```ts
      excludeDilemmaIds: new Set(),
```

- [ ] **Step 4: Implement `rematch()`**

Add near `create()` in `server/src/game/rooms.ts` (the `RematchError`/`RematchResult` types go in the exported-types block near the other `*Result` types, e.g. next to `StartGameResult`):

```ts
export type RematchError = 'ROOM_NOT_FOUND' | 'NOT_FINISHED';
export type RematchResult = { ok: true; room: Room } | { ok: false; error: RematchError };
```

```ts
  /**
   * Return a finished room (FINAL_AWARDS/FINAL_DUEL) to LOBBY with the same
   * code/leader/roster, remembering this game's dilemmas so the next
   * startGame's deck excludes them. Resets every round-scoped field `create()`
   * initializes except code/createdAt/leaderId/players (those must survive).
   */
  rematch(code: string): RematchResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'FINAL_AWARDS' && room.phase !== 'FINAL_DUEL') {
      return { ok: false, error: 'NOT_FINISHED' };
    }
    for (const d of room.plannedDilemmas) room.excludeDilemmaIds.add(d.id);
    room.phase = 'LOBBY';
    room.dilemmaCount = null;
    room.register = null;
    room.format = 'classic';
    room.startTappa = null;
    room.durata = null;
    room.plannedDilemmas = [];
    room.plannedTappe = [];
    room.currentTappa = null;
    room.tappaDilemmas = 0;
    room.tappaSwings = 0;
    room.story = null;
    room.storyId = null;
    room.plannedScenes = [];
    room.plannedActs = [];
    room.storyDecisions = [];
    room.currentSceneNarration = null;
    room.currentSceneConsequence = null;
    room.currentDecision = null;
    room.currentEpilogo = null;
    room.currentAct = null;
    room.dilemmaIndex = 0;
    room.phaseExpiresAt = null;
    room.deck = null;
    room.currentDilemma = null;
    room.submittedDilemmas = [];
    room.dilemmaAuthors = new Map();
    room.submittedQueue = [];
    room.devilRoundIndex = null;
    room.knowRoundIndex = null;
    room.knowTargets = new Map();
    room.knowGuesses = new Map();
    room.infiltratorId = null;
    room.infiltratorFlips = 0;
    room.accusations = new Map();
    room.infiltratoResult = null;
    room.teams = new Map();
    room.votes = new Map();
    room.votes1 = new Map();
    room.confirmedVote2 = new Set();
    room.defenders = [];
    room.defenseTurnIndex = 0;
    room.defenseArgument = null;
    room.raisedHands = [];
    room.interventiQueue = [];
    room.interventiIndex = 0;
    room.turnMinEndsAt = null;
    room.turnStartedAt = null;
    room.stats = new Map();
    room.duelTurnIndex = 0;
    room.duelScore = new Map();
    room.duelAgreements = 0;
    room.lastReactionAt = new Map();
    room.predictions = new Map();
    room.swingBets = new Map();
    room.speakerVotes = new Map();
    room.defenseCounts = new Map();
    return { ok: true, room };
  }
```

- [ ] **Step 5: Make `startGame()` consume + clear the exclude set**

In `server/src/game/rooms.ts`, find the classic-mode branch of `startGame()`:

```ts
      room.deck = this.makeDeck(register as ContentRegister);
```

Change to:

```ts
      room.deck = this.makeDeck(register as ContentRegister);
      if (room.excludeDilemmaIds.size > 0) {
        room.deck = new Deck(room.deck.cards.filter((d) => !room.excludeDilemmaIds.has(d.id)));
      }
```

And clear the set once it's been applied — add near the top of `startGame()`, right after the `if (room.phase !== 'LOBBY') return ...` guard is passed (so it's cleared exactly once per game start, regardless of format):

```ts
    const excludeIds = room.excludeDilemmaIds;
    room.excludeDilemmaIds = new Set();
```

(then use `excludeIds` — the captured reference — in the classic-branch filter above instead of `room.excludeDilemmaIds`, since the field was already reset to a fresh empty Set by this point).

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "rematch"`
Expected: PASS, all three tests.

- [ ] **Step 7: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS.

- [ ] **Step 8: Add the socket handler**

In `server/src/index.ts`, add near `leader:advancePhase`:

```ts
  // The leader returns a finished room to LOBBY for a rematch: same roster,
  // code, and leader; the next game's deck skips this game's dilemmas.
  socket.on('leader:rematch', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    const result = rooms.rematch(code);
    if (!result.ok) return;
    broadcastLobby(code);
    broadcastGameState(code);
  });
```

- [ ] **Step 9: Add the client event + wire the button**

In `client/src/shared/events.ts`, add to `SocketEvents` (near `LeaderAdvancePhase`):

```ts
  /** Leader returns a finished room to LOBBY for a rematch (same roster/code). */
  LeaderRematch: 'leader:rematch',
```

In `client/src/player/PlayerApp.tsx`, add a handler near `advance`:

```ts
  const rematch = () => getSocket().emit(SocketEvents.LeaderRematch);
```

Pass it down to `StatusView` (in the generic in-game `StatusView` render, alongside the existing `onAdvance={advance}`):

```tsx
        <StatusView
          phase={phase}
          game={game}
          remaining={remaining}
          playerId={playerId}
          isLeader={isLeader}
          onAdvance={advance}
          onRematch={rematch}
          infiltratoRole={infiltratoRole}
          predictionResult={predictionResult}
          swingBetResult={swingBetResult}
          knowResult={knowResult}
          blindSpot={blindSpot}
          skipButton={skipButton}
        />
```

- [ ] **Step 10: Add the button to `StatusView.tsx`**

Add `onRematch: () => void;` to `StatusViewProps` and the destructure. In the `FINAL_AWARDS` branch, right after the NorthStar `Card` (before the `blindSpot` card), add:

```tsx
          {isLeader && (
            <Button variant="primary" onClick={onRematch} style={{ marginTop: '0.25rem' }}>
              Giocate ancora ▶
            </Button>
          )}
```

Do the same in the `FINAL_DUEL` branch (currently just a "guarda lo schermo" paragraph) — add the same button, gated `isLeader`, right after that paragraph.

- [ ] **Step 11: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('shows "Giocate ancora" to the leader at FINAL_AWARDS and emits leader:rematch', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        awards: [],
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /giocate ancora/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:rematch');
  });

  it('does not show "Giocate ancora" to a non-leader at FINAL_AWARDS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        awards: [],
        leaderId: 'p2',
      });
    });
    expect(screen.queryByRole('button', { name: /giocate ancora/i })).toBeNull();
  });
```

- [ ] **Step 12: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 13: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/rooms.ts server/src/index.ts server/src/game/__tests__/rooms.test.ts \
  client/src/shared/events.ts client/src/player/PlayerApp.tsx \
  client/src/player/views/StatusView.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(rematch): leader can restart the same room without re-scanning the QR"
```

---

## Task 4 — Item 1.5: Reveal dell'autore

At PHASE_RESULTS, if the just-played dilemma was written by a player, reveal
"Indovinate chi l'ha scritto… ✍️ SARA!". The authorship lookup
(`room.dilemmaAuthors: Map<dilemmaId, playerId>`) already exists (it drives
the ✍️ L'Autore award) — this is a read + a new public field + a UI card, not
new tracking.

**Files:**
- Modify: `server/src/game/rooms.ts` (new `RoomStore.currentDilemmaAuthor()`)
- Modify: `server/src/index.ts` (`gameStatePayload`: add `dilemmaAuthor`)
- Modify: `client/src/shared/events.ts` (`GameStatePayload.dilemmaAuthor`)
- Modify: `client/src/player/views/StatusView.tsx` (the reveal card, PHASE_RESULTS branch)
- Test: `server/src/game/__tests__/rooms.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing `Room.dilemmaAuthors`, `Room.currentDilemma`, `Room.players`.
- Produces: `RoomStore.currentDilemmaAuthor(code): string | null`.

- [ ] **Step 1: Write the failing test**

Add to `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('currentDilemmaAuthor', () => {
  it('reveals the nickname only at PHASE_RESULTS, for a player-submitted dilemma', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    const room = store.get(code)!;
    room.players.set('sara', { id: 'sara', nickname: 'Sara' });
    room.currentDilemma = { id: 'd1', text: 'Q?', optionA: 'A', optionB: 'B', register: 'vita' };
    room.dilemmaAuthors.set('d1', 'sara');
    expect(store.currentDilemmaAuthor(code)).toBeNull(); // not PHASE_RESULTS yet
    room.phase = 'PHASE_RESULTS';
    expect(store.currentDilemmaAuthor(code)).toBe('Sara');
  });

  it('is null for a deck dilemma with no author', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const room = store.get(code)!;
    room.phase = 'PHASE_RESULTS';
    room.currentDilemma = { id: 'd2', text: 'Q?', optionA: 'A', optionB: 'B', register: 'vita' };
    expect(store.currentDilemmaAuthor(code)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "currentDilemmaAuthor"`
Expected: FAIL — method doesn't exist.

- [ ] **Step 3: Implement it**

In `server/src/game/rooms.ts`, add near the other PHASE_RESULTS-gated readers (e.g. next to `publicSwing`):

```ts
  /** The nickname of whoever wrote the current dilemma, revealed only at
   * PHASE_RESULTS; null otherwise, or if it was a deck (non-authored) dilemma. */
  currentDilemmaAuthor(code: string): string | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'PHASE_RESULTS' || !room.currentDilemma) return null;
    const authorId = room.dilemmaAuthors.get(room.currentDilemma.id);
    if (!authorId) return null;
    return room.players.get(authorId)?.nickname ?? null;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "currentDilemmaAuthor"`
Expected: PASS.

- [ ] **Step 5: Wire `gameStatePayload` + the client type**

In `server/src/index.ts`, add to `gameStatePayload` near the other PHASE_RESULTS-gated fields (e.g. next to `swing`):

```ts
    // The current dilemma's author nickname, revealed only at PHASE_RESULTS
    // (null otherwise, or for a deck dilemma nobody wrote).
    dilemmaAuthor: rooms.currentDilemmaAuthor(room.code),
```

In `client/src/shared/events.ts`, add to `GameStatePayload` near `swing`:

```ts
  /** The current dilemma's author nickname, shown only at PHASE_RESULTS; null otherwise. */
  dilemmaAuthor: string | null;
```

- [ ] **Step 6: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('reveals the dilemma author at PHASE_RESULTS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemmaAuthor: 'Sara',
        leaderId: null,
      });
    });
    expect(screen.getByText(/sara/i)).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "reveals the dilemma author"`
Expected: FAIL — nothing renders `dilemmaAuthor` yet.

- [ ] **Step 8: Add the reveal card**

In `client/src/player/views/StatusView.tsx`, in the `PHASE_RESULTS` branch, add (anywhere among the other result paragraphs, e.g. right after the `ResultsPanel`):

```tsx
          {game?.dilemmaAuthor && (
            <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Indovinate chi l'ha scritto… ✍️ <strong>{game.dilemmaAuthor}</strong>!
            </p>
          )}
```

- [ ] **Step 9: Run to verify it passes, then the full suite**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx && npm --prefix server test`
Expected: PASS.

- [ ] **Step 10: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/rooms.ts server/src/index.ts server/src/game/__tests__/rooms.test.ts \
  client/src/shared/events.ts client/src/player/views/StatusView.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(results): reveal who wrote a player-submitted dilemma"
```

---

## Task 5 — Item 1.4: Applausometro di fine difesa

Right when a defender's turn ends, show "Marco: 👏×8 🔥×5" for ~3s on host +
phones. Reactions are currently only tracked as a single cumulative
game-long counter per player (`PlayerStats.reactionsReceived`, for the
Beniamino award) — there's no per-turn, per-emoji breakdown. This needs new,
narrowly-scoped tracking that resets every turn, alongside (not replacing)
the existing cumulative stat.

**Files:**
- Modify: `server/src/game/rooms.ts` (`Room.turnReactionTally`, `Room.lastTurnApplause`, snapshot logic in `advancePhase()`)
- Modify: `server/src/game/reactions.ts` (increment the per-turn tally)
- Modify: `server/src/game/defenseSetup.ts` (`armTurn` resets the tally)
- Modify: `server/src/index.ts` (`gameStatePayload`: add `lastTurnApplause`)
- Modify: `client/src/shared/events.ts` (the new type)
- Modify: `client/src/shared/ui/PublicViews.tsx` (new small `ApplauseTally` component)
- Modify: `client/src/host/HostApp.tsx`, `client/src/player/PlayerApp.tsx` (mount it, 3s auto-hide)
- Test: `server/src/game/__tests__/rooms.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: existing `Reaction` type, existing `defenseTurns.currentSpeakerId(room)`, existing `defenseSetup.armTurn`.
- Produces: `Room.lastTurnApplause: { speakerId: string; nickname: string; tally: Partial<Record<Reaction, number>> } | null`.

- [ ] **Step 1: Write the failing test — the per-turn tally resets and snapshots correctly**

Add to `server/src/game/__tests__/rooms.test.ts` (reuse the file's `defenseRoom` helper if present — it drives a fresh room to DEFENSE with a known 2-defender split; otherwise inline the setup):

```ts
describe('lastTurnApplause', () => {
  it('tallies reactions per emoji for the CURRENT turn and snapshots them when the turn ends', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // sock-0 defends A, sock-1 defends B (2 defenders)
    const room = store.get(code)!;
    expect(room.lastTurnApplause).toBeNull(); // nothing yet, turn just started

    store.react(code, 'sock-1', '👏', 1_000); // sock-1 is NOT speaking yet — reacts to sock-0
    store.react(code, 'sock-2', '👏', 1_100);
    store.react(code, 'sock-2', '🔥', 1_200);
    expect(room.turnReactionTally).toEqual({ '👏': 2, '🔥': 1 });

    // Force-advance to the next defender's turn — the snapshot should capture
    // the FIRST defender's tally, and the live tally resets for the second.
    store.advancePhase(code);
    expect(room.lastTurnApplause).toEqual({
      speakerId: 'sock-0',
      nickname: 'P0',
      tally: { '👏': 2, '🔥': 1 },
    });
    expect(room.turnReactionTally).toEqual({});
  });

  it('is null when the finished turn drew no reactions at all', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    store.advancePhase(store.get(code)!.code);
    expect(store.get(code)!.lastTurnApplause).toBeNull();
  });
});
```

(Check the file's `defenseRoom` helper signature exactly — it may not return a `code` the same way; adjust the second test's `store.get(code)!.code` reference if `code` is already the string, not an object.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "lastTurnApplause"`
Expected: FAIL — `room.turnReactionTally`/`room.lastTurnApplause` don't exist.

- [ ] **Step 3: Add the new `Room` fields**

In `server/src/game/rooms.ts`, add to the `Room` interface (near `lastReactionAt`):

```ts
  /** Live per-emoji reaction tally for the CURRENT speaker's turn only; reset
   * by armTurn() at the start of every DEFENSE/INTERVENTI turn. */
  turnReactionTally: Partial<Record<Reaction, number>>;
  /** Snapshot of the applause for the turn that JUST ended (who + their
   * per-emoji tally); null if that turn drew no reactions, or outside a
   * DEFENSE/INTERVENTI turn transition. A transient client-side "beat" — the
   * client shows it for ~3s and locally lets it go stale. */
  lastTurnApplause: { speakerId: string; nickname: string; tally: Partial<Record<Reaction, number>> } | null;
```

Add to `create()`'s room literal (near `lastReactionAt: new Map(),`):

```ts
      turnReactionTally: {},
      lastTurnApplause: null,
```

- [ ] **Step 4: Increment the tally in `reactions.ts`**

In `server/src/game/reactions.ts`, in `react()`, add right after the existing cumulative-stat increment:

```ts
  const speakerId = currentSpeakerId(room);
  if (speakerId) {
    const s = ensureStats(room, speakerId);
    s.reactionsReceived = (s.reactionsReceived ?? 0) + 1;
  }
  room.turnReactionTally[emoji] = (room.turnReactionTally[emoji] ?? 0) + 1;
  return { ok: true, emoji };
```

(Note: `emoji` is already narrowed to `Reaction` by the `isReaction(emoji)` guard earlier in the function.)

- [ ] **Step 5: Reset the tally in `armTurn()`**

In `server/src/game/defenseSetup.ts`, in `armTurn`, add at the top of the function body:

```ts
export function armTurn(room: Room, now: number): void {
  room.turnReactionTally = {};
  const interventi = room.phase === 'INTERVENTI';
  ...
```

- [ ] **Step 6: Snapshot the finished turn's applause in `advancePhase()`**

In `server/src/game/rooms.ts`'s `advancePhase()`, add right after the ACCUSE branch and before the INTERVENTI branch:

```ts
    // A DEFENSE/INTERVENTI turn is about to end (armTurn will reset the live
    // tally for whoever speaks next) — snapshot the applause for the speaker
    // who JUST finished, so the client can show a brief "applausometro" beat.
    if (room.phase === 'DEFENSE' || room.phase === 'INTERVENTI') {
      const endingSpeakerId = defenseTurns.currentSpeakerId(room);
      const endingSpeaker = endingSpeakerId ? room.players.get(endingSpeakerId) : undefined;
      room.lastTurnApplause =
        endingSpeaker && Object.keys(room.turnReactionTally).length > 0
          ? { speakerId: endingSpeaker.id, nickname: endingSpeaker.nickname, tally: { ...room.turnReactionTally } }
          : null;
    }
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "lastTurnApplause"`
Expected: PASS, both tests.

- [ ] **Step 8: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS.

- [ ] **Step 9: Wire `gameStatePayload` + the client type**

In `server/src/index.ts`, add to `gameStatePayload` near `defense`:

```ts
    // Applause for the DEFENSE/INTERVENTI turn that just ended (speaker +
    // per-emoji tally); null if that turn drew no reactions. A transient
    // beat — the client shows it briefly then lets it go stale.
    lastTurnApplause: room.lastTurnApplause,
```

In `client/src/shared/events.ts`, add (the `Reaction` type is already exported/mirrored there):

```ts
  /** Applause for the DEFENSE/INTERVENTI turn that just ended; null otherwise. */
  lastTurnApplause: { speakerId: string; nickname: string; tally: Partial<Record<Reaction, number>> } | null;
```

- [ ] **Step 10: Add the shared `ApplauseTally` component**

In `client/src/shared/ui/PublicViews.tsx`, add:

```tsx
/** The just-finished speaker's live reaction tally ("Marco: 👏×8 🔥×5"), shown
 * as a brief overlay by the caller (which owns the 3s auto-hide timing). */
export function ApplauseTally({
  applause,
}: {
  applause: { nickname: string; tally: Partial<Record<string, number>> };
}) {
  const entries = Object.entries(applause.tally).filter(([, n]) => (n ?? 0) > 0);
  if (entries.length === 0) return null;
  return (
    <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
      {applause.nickname}: {entries.map(([emoji, n]) => `${emoji}×${n}`).join(' ')}
    </p>
  );
}
```

- [ ] **Step 11: Mount it with a 3s auto-hide, on host + phone**

In `client/src/player/PlayerApp.tsx`, add state + effect near the other transient-result state:

```ts
  const [showApplause, setShowApplause] = useState(false);
  useEffect(() => {
    if (!game?.lastTurnApplause) return;
    setShowApplause(true);
    const t = setTimeout(() => setShowApplause(false), 3_000);
    return () => clearTimeout(t);
  }, [game?.lastTurnApplause]);
```

Render `{showApplause && game?.lastTurnApplause && <ApplauseTally applause={game.lastTurnApplause} />}` in the `DEFENSE`/`INTERVENTI` branch (inside `DefenseView`'s parent wrapper, or passed as a prop into `DefenseView` similarly to `skipButton` — pick whichever keeps `DefenseView` presentational; passing it as a new `applauseOverlay: ReactNode` prop mirrors the existing `skipButton` pattern).

Do the equivalent in `client/src/host/HostApp.tsx` (it already has its own local phase-branch rendering, not `DefenseView`) — add the same `showApplause` state/effect and render `<ApplauseTally applause={game.lastTurnApplause} />` in its DEFENSE/INTERVENTI section.

- [ ] **Step 12: Write the failing client test**

Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('shows the applausometro for 3s right after a DEFENSE turn ends', () => {
    vi.useFakeTimers();
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
        dilemma: { text: 'Q?', optionA: 'A', optionB: 'B' },
        defense: {
          kind: 'defense', speaker: { id: 'p2', nickname: 'Bea', side: 'A' }, speakerId: 'p2',
          turn: 1, totalTurns: 2, argument: null, spunti: null, raisedCount: 0, queue: null,
          minEndsAt: null, canFinish: true, startedAt: null,
        },
        lastTurnApplause: { speakerId: 'p3', nickname: 'Marco', tally: { '👏': 8, '🔥': 5 } },
        leaderId: null,
      });
    });
    expect(screen.getByText(/marco/i)).toBeInTheDocument();
    expect(screen.getByText(/👏×8/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_100));
    expect(screen.queryByText(/marco/i)).toBeNull();
    vi.useRealTimers();
  });
```

- [ ] **Step 13: Run to verify it passes**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 14: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/rooms.ts server/src/game/reactions.ts server/src/game/defenseSetup.ts \
  server/src/index.ts server/src/game/__tests__/rooms.test.ts client/src/shared/events.ts \
  client/src/shared/ui/PublicViews.tsx client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx \
  client/src/player/views/DefenseView.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(defense): applausometro — show the just-finished speaker's reaction tally for 3s"
```

---

## Task 6 — Item 1.2: Reveal a beat umani

Two independent pieces bundled under one spec item:

**(a) A 3-2-1 countdown before the split is shown.** Needs **no server
change** — it's a purely cosmetic client-side delay in front of data the
server already sent. Bump `SPLIT_REVEAL`'s duration from 6s to 9s (3s
countdown + the original 6s reveal, so the reveal itself isn't shortchanged).

**(b) PHASE_RESULTS becomes 2-3 leader-paced beats** (1: suspense headline; 2:
attribution + confetti; 3: private per-player outcomes), with a fallback
timer per beat so a distracted leader doesn't freeze the game (unlike the
existing TAPPA_RECAP/STORY_INTRO leader-paced cards, which have **no**
fallback today — this task doesn't fix those, only avoids repeating the gap
in what it adds). This reuses the *existing* `leader:advancePhase` event and
per-phase-timer machinery via a simple in-phase beat counter — no new
`GamePhase` values, no new socket events.

**Files:**
- Modify: `server/src/game/phases.ts` (`SPLIT_REVEAL` duration bump; new `RESULTS_BEATS_TOTAL`, `RESULTS_BEAT_DURATIONS_MS`; `PHASE_RESULTS`'s duration becomes beat 1's)
- Modify: `server/src/game/rooms.ts` (`Room.resultsBeat`; beat-advance branch in `advancePhase()`; reset on PHASE_RESULTS entry)
- Modify: `server/src/index.ts` (`gameStatePayload`: `resultsBeat`, `resultsBeatsTotal`)
- Modify: `client/src/shared/events.ts` (the two new fields)
- Modify: `client/src/shared/ui/PublicViews.tsx` (`ResultsPanel` gains a `beat` prop)
- Modify: `client/src/host/HostApp.tsx`, `client/src/player/views/StatusView.tsx` (pass `beat`; gate the private-result paragraphs to beat 3)
- New: `client/src/shared/useLeadInCountdown.ts` (the 3-2-1 hook)
- Modify: `client/src/host/audio/cues.ts` (PHASE_RESULTS's cue moves from phase-entry to beat-entry), `client/src/host/audio/useHostAudio.ts` (new beat-keyed effect)
- Test: `server/src/game/__tests__/rooms.test.ts`, `server/src/game/__tests__/phases.test.ts`, `client/src/host/audio/cues.test.ts`, `client/src/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: nothing from other FASE 1 tasks.
- Produces: `Room.resultsBeat: number` (1-based), `RESULTS_BEATS_TOTAL = 3`. `GameStatePayload.resultsBeat: number`, `resultsBeatsTotal: number`. **Task 7 consumes both** (to know when beat 2's attribution is showing, so it can overlay the ribaltone title).

- [ ] **Step 1: Write the failing test — PHASE_RESULTS walks 3 beats before the next dilemma**

Add to `server/src/game/__tests__/rooms.test.ts` (build on the file's existing `defenseRoom`/round-walking helpers):

```ts
describe('PHASE_RESULTS beats', () => {
  it('advances through 3 beats (leader:advancePhase = one beat) before the next DILEMMA_REVEAL', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        ['A', 'B', 'A'].forEach((s, i) => store.vote(code, `sock-${i}`, s as VoteChoice));
      }
    }
    expect(store.get(code)!.phase).toBe('PHASE_RESULTS');
    expect(store.get(code)!.resultsBeat).toBe(1);

    store.advancePhase(code); // leader taps "Continua"
    expect(store.get(code)!.phase).toBe('PHASE_RESULTS');
    expect(store.get(code)!.resultsBeat).toBe(2);

    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('PHASE_RESULTS');
    expect(store.get(code)!.resultsBeat).toBe(3);

    store.advancePhase(code); // last beat done -> falls through to the next dilemma
    expect(store.get(code)!.phase).toBe('DILEMMA_REVEAL');
  });

  it('resets resultsBeat to 1 on the NEXT round\'s PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    const toPhaseResults = () => {
      while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 20) {
        store.advancePhase(code);
        if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
          ['A', 'B', 'A'].forEach((s, i) => store.vote(code, `sock-${i}`, s as VoteChoice));
        }
      }
    };
    toPhaseResults();
    store.advancePhase(code);
    store.advancePhase(code);
    store.advancePhase(code); // into round 2's DILEMMA_REVEAL
    toPhaseResults();
    expect(store.get(code)!.resultsBeat).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "PHASE_RESULTS beats"`
Expected: FAIL — `resultsBeat` doesn't exist, and a single `advancePhase()` call moves straight past PHASE_RESULTS today.

- [ ] **Step 3: Add the phases.ts constants**

In `server/src/game/phases.ts`, change:

```ts
  SPLIT_REVEAL: 6_000,
```

to:

```ts
  SPLIT_REVEAL: 9_000, // 3s client-side "3-2-1" lead-in (cosmetic) + the original 6s reveal
```

Add near the other timing constants, BEFORE `PHASE_DURATIONS_MS` (so it can be referenced there):

```ts
/**
 * PHASE_RESULTS is split into leader-paced "beats" (1: suspense headline;
 * 2: attribution + confetti; 3: private per-player outcomes), each with its
 * own fallback duration in case the leader doesn't tap "Continua ▶". Reusing
 * the existing leader:advancePhase event: each tap advances one beat; once
 * the last beat is done, the normal next-dilemma transition takes over.
 */
export const RESULTS_BEATS_TOTAL = 3;
export const RESULTS_BEAT_DURATIONS_MS = [5_000, 7_000, 6_000];
```

Change:

```ts
  PHASE_RESULTS: 8_000,
```

to:

```ts
  PHASE_RESULTS: RESULTS_BEAT_DURATIONS_MS[0], // beat 1's fallback; later beats are armed explicitly in advancePhase()
```

- [ ] **Step 4: Add the `resultsBeat` field**

In `server/src/game/rooms.ts`, add to the `Room` interface (near `dilemmaIndex`):

```ts
  /** Which PHASE_RESULTS "beat" is showing (1-based); meaningless outside PHASE_RESULTS. */
  resultsBeat: number;
```

Add to `create()`'s room literal:

```ts
      resultsBeat: 1,
```

Add `RESULTS_BEATS_TOTAL, RESULTS_BEAT_DURATIONS_MS` to the existing `import { type GamePhase, PHASE_DURATIONS_MS, ... } from './phases';` block.

- [ ] **Step 5: Add the beat-advance branch + the entry reset**

In `server/src/game/rooms.ts`'s `advancePhase()`, add right after the two DEFENSE-turn-advance branches (after `if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) { ... return { ok: true, room }; }`), before the `const step = (phase, idx) => ...` line:

```ts
    // A finished PHASE_RESULTS beat: walk through the 2-3 beats (leader:advancePhase
    // = one beat) before falling through to the normal next-dilemma transition below.
    if (room.phase === 'PHASE_RESULTS' && room.resultsBeat < RESULTS_BEATS_TOTAL) {
      room.resultsBeat++;
      room.phaseExpiresAt = this.now() + RESULTS_BEAT_DURATIONS_MS[room.resultsBeat - 1];
      return { ok: true, room };
    }
```

Then, where the generic transition hooks live (near `if (transition.phase === 'DILEMMA_REVEAL') { ... }`), add:

```ts
    // Entering (or re-entering, next round) PHASE_RESULTS always starts at beat 1.
    if (transition.phase === 'PHASE_RESULTS') {
      room.resultsBeat = 1;
    }
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "PHASE_RESULTS beats"`
Expected: PASS, both tests.

- [ ] **Step 7: Run the full server suite**

Run: `npm --prefix server test`
Expected: PASS. (Check `server/src/game/__tests__/phases.test.ts` and any other test asserting `PHASE_DURATIONS_MS.SPLIT_REVEAL`/`.PHASE_RESULTS` exact values — per the earlier grep only `phases.ts` itself contains those literals, so this should be a clean pass; if something else breaks, read it before changing it — it may be asserting a duration that other code still depends on.)

- [ ] **Step 8: Wire `gameStatePayload` + the client type**

In `server/src/index.ts`, add to `gameStatePayload` near `dilemmaIndex`:

```ts
    // Which PHASE_RESULTS "beat" is showing (1-based) + how many there are.
    resultsBeat: room.resultsBeat,
    resultsBeatsTotal: RESULTS_BEATS_TOTAL,
```

Add `RESULTS_BEATS_TOTAL` to `index.ts`'s existing import from `./game/rooms` (it's re-exported from `phases.ts` via `rooms.ts`'s `export * from './phases';`).

In `client/src/shared/events.ts`, add to `GameStatePayload`:

```ts
  /** Which PHASE_RESULTS "beat" is showing (1-based); meaningless outside PHASE_RESULTS. */
  resultsBeat: number;
  /** How many beats PHASE_RESULTS has (currently 3). */
  resultsBeatsTotal: number;
```

- [ ] **Step 9: Add the 3-2-1 lead-in hook**

Create `client/src/shared/useLeadInCountdown.ts`:

```ts
import { useEffect, useState } from 'react';

/**
 * Counts down from `seconds` to 0 in real time from the moment `active` first
 * becomes true; resets to `seconds` whenever `active` goes false (so the next
 * time it becomes true — e.g. the next round's SPLIT_REVEAL — it counts down
 * again). Purely a client-side theatrical delay: it never gates or blocks the
 * underlying data, which the server already sent — just when it's *shown*.
 */
export function useLeadInCountdown(active: boolean, seconds: number): number {
  const [n, setN] = useState(active ? seconds : 0);
  useEffect(() => {
    if (!active) {
      setN(seconds);
      return;
    }
    setN(seconds);
    const id = setInterval(() => setN((cur) => Math.max(0, cur - 1)), 1000);
    return () => clearInterval(id);
  }, [active, seconds]);
  return n;
}
```

- [ ] **Step 10: Write the failing client test for the lead-in + the beats**

Add to `client/src/player/PlayerApp.test.tsx`:

```tsx
  it('shows a 3-2-1 countdown before the split at SPLIT_REVEAL, then the split', () => {
    vi.useFakeTimers();
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'SPLIT_REVEAL',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Q?', optionA: 'A', optionB: 'B' },
        split: { A: 2, B: 1 },
        leaderId: null,
      });
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_100));
    expect(screen.getByText(/A · 2/i)).toBeInTheDocument(); // the SplitBar, now revealed
    vi.useRealTimers();
  });

  it('shows only the headline at PHASE_RESULTS beat 1, and private results only at beat 3', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        resultsBeat: 1,
        resultsBeatsTotal: 3,
        swing: { first: { A: 1, B: 2 }, second: { A: 2, B: 1 }, switched: 1, netSwing: { A: 1, B: -1 }, attribution: [] },
        leaderId: null,
      });
    });
    expect(screen.queryByText(/le difese di/i)).toBeNull(); // attribution hidden at beat 1
    act(() => {
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        resultsBeat: 3,
        resultsBeatsTotal: 3,
        swing: { first: { A: 1, B: 2 }, second: { A: 2, B: 1 }, switched: 1, netSwing: { A: 1, B: -1 }, attribution: [] },
        leaderId: null,
      });
      serverEmit('player:predictionResult', { correct: true, predicted: 'A', actual: 'A' });
    });
    expect(screen.getByText(/pronostico azzeccato/i)).toBeInTheDocument();
  });
```

Adjust the exact `getByText` matchers once `ResultsPanel`'s beat-1 headline copy is written in Step 11 — these assert the *shape* (attribution hidden at beat 1, private results only at beat 3), not exact wording.

- [ ] **Step 11: Run to verify it fails**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx -t "beat"`
Expected: FAIL — no countdown exists yet; `ResultsPanel` always shows attribution; private results always show regardless of beat.

- [ ] **Step 12: Give `ResultsPanel` a `beat` prop**

In `client/src/shared/ui/PublicViews.tsx`, change `ResultsPanel`'s signature and body:

```tsx
/** The persuasion swing + per-defender attribution (PHASE_RESULTS). Aggregate
 * counts only — never who voted what. Beat 1: headline only (suspense). Beat
 * 2+: full attribution + confetti. */
export function ResultsPanel({ swing, beat }: { swing: PublicSwing; beat: number }) {
  return (
    <section
      aria-label="Risultati della persuasione"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', maxWidth: 'min(92vw, 50rem)' }}
    >
      {beat >= 2 && swing.switched > 0 && <Celebration />}
      <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
        {swing.switched === 0
          ? 'Nessuno ha cambiato idea 🪨'
          : `${swing.switched} ${swing.switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea! 🔄`}
      </p>
      {beat >= 2 && swing.attribution.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {swing.attribution.map((imp) => (
            <p key={imp.defender.id} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
              Le difese di <span style={{ color: 'var(--gold)' }}>{imp.defender.nickname}</span> hanno
              spostato {imp.votes} {imp.votes === 1 ? 'voto' : 'voti'} verso {imp.defender.side}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 13: Pass `beat` from both callers**

In `client/src/host/HostApp.tsx`, change:

```tsx
        {phase === 'PHASE_RESULTS' && swing && <ResultsPanel swing={swing} />}
```

to:

```tsx
        {phase === 'PHASE_RESULTS' && swing && <ResultsPanel swing={swing} beat={game.resultsBeat} />}
```

In `client/src/player/views/StatusView.tsx`, change:

```tsx
          {game?.swing && <ResultsPanel swing={game.swing} />}
```

to:

```tsx
          {game?.swing && <ResultsPanel swing={game.swing} beat={game.resultsBeat} />}
```

Then gate the three private-result paragraphs right below it (currently always shown) to beat 3 — wrap the existing `{predictionResult && (...)}`, `{swingBetResult && (...)}`, `{knowResult && (...)}` block in `{game?.resultsBeat === 3 && (<>...</>)}`.

- [ ] **Step 14: Add the lead-in countdown to SPLIT_REVEAL, both callers**

In `client/src/player/views/StatusView.tsx`, change the `SPLIT_REVEAL` branch:

```tsx
      ) : phase === 'SPLIT_REVEAL' ? (
        <>
          {game?.split && <SplitBar split={game.split} />}
          {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
          <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
            Ecco come si è diviso il gruppo — ora si difende
          </p>
        </>
```

to (compute `leadIn` once near the top of the component, alongside the other hooks):

```tsx
      ) : phase === 'SPLIT_REVEAL' ? (
        leadIn > 0 ? (
          <div aria-label="Conto alla rovescia" style={{ fontSize: '5rem', fontWeight: 800 }}>{leadIn}</div>
        ) : (
          <>
            {game?.split && <SplitBar split={game.split} />}
            {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
            <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
              Ecco come si è diviso il gruppo — ora si difende
            </p>
          </>
        )
```

Add near the top of `StatusView`:

```ts
  const leadIn = useLeadInCountdown(phase === 'SPLIT_REVEAL', 3);
```

Import `useLeadInCountdown` from `'../../shared/useLeadInCountdown'`. Do the equivalent in `HostApp.tsx` around its own `{phase === 'SPLIT_REVEAL' && split && <SplitBar split={split} />}` line.

- [ ] **Step 15: Run to verify the client tests pass**

Run: `npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 16: Move the PHASE_RESULTS SFX cue from phase-entry to beat-2-entry**

`sfxForTransition` currently fires `'swing'`/`'reveal'` the instant `PHASE_RESULTS` is entered — but that's now beat 1 (suspense only, no reveal yet). In `client/src/host/audio/cues.ts`, change:

```ts
    case 'PHASE_RESULTS':
      return game.swing && game.swing.switched > 0 ? 'swing' : 'reveal';
```

to:

```ts
    case 'PHASE_RESULTS':
      return null; // beat 1 is suspense-only; the reveal cue now fires on beat 2 — see sfxForResultsBeat
```

Add a new exported function in the same file:

```ts
/** The sting for entering PHASE_RESULTS beat 2 (the attribution reveal), or
 * null for any other beat / no game. Beat 1 is deliberately silent (suspense). */
export function sfxForResultsBeat(beat: number, game: CueGame): SfxName | null {
  if (beat !== 2) return null;
  return game.swing && game.swing.switched > 0 ? 'swing' : 'reveal';
}
```

Update `client/src/host/audio/cues.test.ts`: the existing assertions like `sfxForTransition('INTERVENTI', 'PHASE_RESULTS', game({ swing: { switched: 2 } }))` expecting `'swing'`/`'reveal'` now must expect `null` (move that coverage to a new `describe('sfxForResultsBeat', ...)` block asserting the beat-2 behavior instead).

- [ ] **Step 17: Fire it from `useHostAudio.ts`**

In `client/src/host/audio/useHostAudio.ts`, import `sfxForResultsBeat` alongside `sfxForTransition`, and add a new effect near the existing phase-cue effect:

```ts
  // PHASE_RESULTS beat cues: the phase itself doesn't change between beats,
  // so this watches resultsBeat directly (the phase-keyed effect above won't
  // re-fire for it).
  const prevBeatRef = useRef<number | null>(null);
  useEffect(() => {
    const prevBeat = prevBeatRef.current;
    const beat = game?.resultsBeat ?? null;
    prevBeatRef.current = beat;
    if (!active || !game || phase !== 'PHASE_RESULTS' || beat == null || beat === prevBeat) return;
    const cue = sfxForResultsBeat(beat, game);
    if (cue) playSfx(cue);
  }, [game?.resultsBeat, phase, active, game]);
```

- [ ] **Step 18: Run the full test suite**

Run: `npm test`
Expected: PASS (server + client). Re-check `client/src/host/audio/cues.test.ts` and `useHostAudio`-related tests specifically for the updated PHASE_RESULTS expectations from Step 16.

- [ ] **Step 19: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add server/src/game/phases.ts server/src/game/rooms.ts server/src/index.ts \
  server/src/game/__tests__/rooms.test.ts client/src/shared/events.ts \
  client/src/shared/ui/PublicViews.tsx client/src/shared/useLeadInCountdown.ts \
  client/src/host/HostApp.tsx client/src/player/views/StatusView.tsx \
  client/src/host/audio/cues.ts client/src/host/audio/cues.test.ts client/src/host/audio/useHostAudio.ts \
  client/src/player/PlayerApp.test.tsx
git commit -m "feat(reveal): 3-2-1 lead-in before SPLIT_REVEAL + PHASE_RESULTS as 3 leader-paced beats"
```

---

## Task 7 — Item 1.3: Il ribaltone ha un nome

When the lead flips between VOTE_1 and VOTE_2, or `switched >= 2`, show a
full-screen "IL RIBALTONE DI MARCO" title (naming whichever defender's side
gained the swing) during beat 2, with a distinct SFX. `PublicSwing` already
carries `first`/`second` full tallies + `attribution` — this is a client-side
derivation plus one new dedicated sound.

**Files:**
- New: `client/src/shared/swing.ts` (the `leadOf`/`isRibaltone` derivation, shared by the UI and the audio cue module so neither duplicates it nor imports from the other's folder)
- Modify: `client/src/shared/ui/PublicViews.tsx` (`ResultsPanel`: derive + render the ribaltone title, using `swing.ts`)
- Modify: `client/src/host/audio/cues.ts` (`SfxName` gains `'ribaltone'`; `CueGame.swing` widens to carry `first`/`second`; `sfxForResultsBeat` uses `swing.ts` to pick `'ribaltone'` vs `'swing'`)
- Modify: `client/src/host/audio/sfx.ts` (new recipe)
- Test: `client/src/shared/swing.test.ts`, `client/src/shared/ui/*.test.tsx` (or a new one for `ResultsPanel` if none exists — check first), `client/src/host/audio/cues.test.ts`

**Interfaces:**
- Consumes: Task 6's `ResultsPanel({ swing, beat })`, `sfxForResultsBeat(beat, game)`.
- Produces: nothing new for later tasks (this is the last task in the plan).

- [ ] **Step 1: Write the failing test for the shared derivation**

Create `client/src/shared/swing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { leadOf, isRibaltone } from './swing';

describe('leadOf', () => {
  it('returns the leading side, or null on a tie', () => {
    expect(leadOf({ A: 3, B: 1 })).toBe('A');
    expect(leadOf({ A: 1, B: 3 })).toBe('B');
    expect(leadOf({ A: 2, B: 2 })).toBeNull();
  });
});

describe('isRibaltone', () => {
  it('is true when the lead flips, even with switched=1', () => {
    expect(isRibaltone({ first: { A: 2, B: 1 }, second: { A: 1, B: 2 }, switched: 1 })).toBe(true);
  });
  it('is true when switched>=2, even without a lead flip', () => {
    expect(isRibaltone({ first: { A: 3, B: 0 }, second: { A: 2, B: 1 }, switched: 2 })).toBe(true);
  });
  it('is false for a small non-flipping swing', () => {
    expect(isRibaltone({ first: { A: 3, B: 1 }, second: { A: 2, B: 1 }, switched: 1 })).toBe(false);
  });
  it('is false when the second tally ties (no clear new leader to name)', () => {
    expect(isRibaltone({ first: { A: 2, B: 1 }, second: { A: 2, B: 2 }, switched: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/shared/swing.test.ts`
Expected: FAIL — `./swing` doesn't exist yet.

- [ ] **Step 3: Implement the shared derivation**

Create `client/src/shared/swing.ts`:

```ts
/** A vote tally shape shared by VoteSplit/SwingResult/PublicSwing. */
interface Tally {
  A: number;
  B: number;
}

/** The leading side of a tally, or null on a tie. */
export function leadOf(t: Tally): 'A' | 'B' | null {
  return t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
}

/**
 * Whether a round's swing counts as a "ribaltone" worth naming and stinging:
 * the lead flipped between the first and second vote, or 2+ people changed
 * their mind. A flip only counts if the second tally actually has a leader
 * (a tie has nobody to name). Shared by the UI (the full-screen title) and
 * the audio cue module (which sting to play) so neither duplicates the rule.
 */
export function isRibaltone(swing: { first: Tally; second: Tally; switched: number }): boolean {
  const secondLead = leadOf(swing.second);
  if (secondLead == null) return false;
  const flipped = leadOf(swing.first) !== secondLead;
  return flipped || swing.switched >= 2;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run client/src/shared/swing.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Check for existing `ResultsPanel`/`PublicViews` test coverage**

Run: `find client/src/shared/ui -iname "*.test.tsx"` and read any that cover `ResultsPanel` directly. If none exist, add the new tests to `client/src/player/PlayerApp.test.tsx` instead (it already exercises `ResultsPanel` indirectly through `StatusView`'s PHASE_RESULTS branch), following whichever convention the codebase already uses for this component.

- [ ] **Step 6: Write the failing test for the title**

Add (to whichever file Step 1 identified):

```tsx
  it('titles the ribaltone with the defender who caused it, only at beat 2+, only when the lead flipped or switched>=2', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD', token: 'tok', player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        resultsBeat: 2,
        resultsBeatsTotal: 3,
        swing: {
          first: { A: 2, B: 1 }, // A led
          second: { A: 1, B: 2 }, // B leads now -> flipped
          switched: 1,
          netSwing: { A: -1, B: 1 },
          attribution: [{ defender: { id: 'd1', nickname: 'Marco', side: 'B' }, votes: 1 }],
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/il ribaltone di marco/i)).toBeInTheDocument();
  });

  it('does not title a small, non-flipping swing (switched=1, no lead change) as a ribaltone', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD', token: 'tok', player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        resultsBeat: 2,
        resultsBeatsTotal: 3,
        swing: {
          first: { A: 3, B: 1 }, // A leads
          second: { A: 2, B: 1 }, // A still leads — one voter's tally entry dropped, no flip
          switched: 1,
          netSwing: { A: -1, B: 0 },
          attribution: [{ defender: { id: 'd1', nickname: 'Marco', side: 'B' }, votes: 1 }],
        },
        leaderId: null,
      });
    });
    expect(screen.queryByText(/il ribaltone/i)).toBeNull();
  });
```

- [ ] **Step 7: Run to verify it fails**

Run the test file identified in Step 5 with a `-t` filter matching "ribaltone".
Expected: FAIL — no title renders yet.

- [ ] **Step 8: Add the title to `ResultsPanel`, using the shared derivation**

In `client/src/shared/ui/PublicViews.tsx`, import the Step 3 helpers:

```ts
import { leadOf, isRibaltone } from '../swing';
```

In `ResultsPanel`, right after the existing `beat >= 2` usages, add:

```tsx
  const ribaltone = beat >= 2 && isRibaltone(swing);
  const ribaltoneDefender = ribaltone ? swing.attribution.find((a) => a.defender.side === leadOf(swing.second)) : null;
```

Render the title inside the same section, before the headline paragraph:

```tsx
      {ribaltone && (
        <p style={{ fontSize: 'clamp(1.8rem, 6vw, 3.2rem)', fontWeight: 900, margin: 0, color: 'var(--gold)' }}>
          IL RIBALTONE {ribaltoneDefender ? `DI ${ribaltoneDefender.defender.nickname.toUpperCase()}` : ''}
        </p>
      )}
```

- [ ] **Step 9: Run to verify it passes**

Re-run the same filtered test command from Step 7.
Expected: PASS, both tests.

- [ ] **Step 10: Add the dedicated SFX name + recipe**

In `client/src/host/audio/cues.ts`, change:

```ts
export type SfxName = 'reveal' | 'swing' | 'win' | 'awards' | 'timerWarn' | 'handRaise';
```

to:

```ts
export type SfxName = 'reveal' | 'swing' | 'ribaltone' | 'win' | 'awards' | 'timerWarn' | 'handRaise';
```

Widen `CueGame` so this module can tell a ribaltone from an ordinary swing — change:

```ts
export interface CueGame {
  swing: { switched: number } | null;
  duelResult: { convinced: readonly unknown[] } | null;
}
```

to:

```ts
export interface CueGame {
  swing: { first: { A: number; B: number }; second: { A: number; B: number }; switched: number } | null;
  duelResult: { convinced: readonly unknown[] } | null;
}
```

Import the shared helper: `import { isRibaltone } from '../../shared/swing';`

In `client/src/host/audio/sfx.ts`, add a `ribaltone` entry to `RECIPES` — a bigger, more dramatic variant of the existing `swing` recipe (a third, lower layer):

```ts
  // Bigger dramatic downward swoop + double low hit — a NAMED ribaltone (lead
  // flipped, or 2+ people changed their mind).
  ribaltone: (ctx, dest, t0) => {
    tone(ctx, dest, t0, { freq: 740, freqEnd: 140, start: 0, dur: 0.55, type: 'sawtooth', gain: 0.16 });
    tone(ctx, dest, t0, { freq: 130, start: 0.2, dur: 0.6, type: 'triangle', gain: 0.22 });
    tone(ctx, dest, t0, { freq: 65, start: 0.35, dur: 0.5, type: 'sine', gain: 0.2 });
  },
```

- [ ] **Step 11: Finalize `sfxForResultsBeat` and update its tests**

In `client/src/host/audio/cues.ts`, change `sfxForResultsBeat` (added in Task 6, currently returning only `'swing'`/`'reveal'`) to:

```ts
export function sfxForResultsBeat(beat: number, game: CueGame): SfxName | null {
  if (beat !== 2) return null;
  if (!game.swing || game.swing.switched === 0) return null;
  return isRibaltone(game.swing) ? 'ribaltone' : 'swing';
}
```

In `client/src/host/audio/cues.test.ts`, update the `sfxForResultsBeat` describe block (and its `game()` test helper's `swing` fixture shape, which now needs `first`/`second`, not just `switched`) to cover: beat!==2 → null; switched===0 → null; a flip → `'ribaltone'`; switched>=2 without a flip → `'ribaltone'`; a non-flipping switched===1 → `'swing'`.

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 13: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add client/src/shared/swing.ts client/src/shared/swing.test.ts \
  client/src/shared/ui/PublicViews.tsx client/src/host/audio/cues.ts \
  client/src/host/audio/cues.test.ts client/src/host/audio/sfx.ts \
  client/src/player/PlayerApp.test.tsx
git commit -m "feat(results): name the ribaltone after whoever caused it, with a dedicated sting"
```

---

## Exit criteria (from the spec)

Playtest a Classica game start to finish and confirm:
- SPLIT_REVEAL opens with a visible "3…2…1…" before the split appears.
- PHASE_RESULTS is 2–3 beats you tap through ("Continua ▶"), not one static 8s screen — and if you (the leader) just watch, it still advances on its own within a few seconds per beat.
- A round with 2+ vote-switchers (or a lead flip) shows "IL RIBALTONE DI [nome]" with a distinctly bigger sting than a normal reveal.
- Right after any DEFENSE turn, a brief "Nome: 👏×N 🔥×M" appears for ~3s.
- A round played with a lobby-submitted dilemma reveals its author at PHASE_RESULTS.
- Every phone buzzes in the last 5s of every timed phase.
- A DEFENSE listener's phone always shows the dilemma + which side is being argued, not just who's talking.
- At FINAL_AWARDS, the leader taps "Giocate ancora ▶" and the room is back in LOBBY with the same code/roster — no rescan — and the new game's dilemmas don't repeat the ones just played.

Once clean, move on to FASE 2 (leggerezza strutturale) per
`docs/superpowers/specs/2026-07-07-party-game-perfetto-piano-design.md`.
