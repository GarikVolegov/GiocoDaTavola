import { describe, it, expect } from 'vitest';
import {
  RoomStore,
  generateRoomCode,
  nextPhase,
  isVotingPhase,
  PHASE_DURATIONS_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  DILEMMA_COUNT_OPTIONS,
  type GamePhase,
  type VoteChoice,
} from '../rooms';
import { Deck, type Dilemma } from '../deck';

// helper: add n players to an existing room
function addPlayers(store: RoomStore, code: string, n: number) {
  for (let i = 0; i < n; i++) store.join(code, `p${i}`, `P${i}`);
}

// A small deterministic deck for driving dilemma reveals in tests: rng = () => 0
// always picks index 0, so draws walk the fixture in order (d1, d2, d3, ...).
const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: unknown) => new Deck(DILEMMA_FIXTURE, () => 0);

describe('generateRoomCode', () => {
  it('returns a 4-letter uppercase code', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(/^[A-Z]{4}$/);
    }
  });
});

describe('RoomStore', () => {
  it('creates a room with a 4-letter code and stores it in memory', () => {
    const store = new RoomStore();
    const room = store.create();
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(store.has(room.code)).toBe(true);
    expect(store.get(room.code)).toBe(room);
    expect(store.size).toBe(1);
  });

  it('assigns a unique code to every room', () => {
    const store = new RoomStore();
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(store.create().code);
    expect(codes.size).toBe(100);
  });

  it('retries generation when a code collides with an existing room', () => {
    const queued = ['AAAA', 'AAAA', 'BBBB'];
    let i = 0;
    const store = new RoomStore(() => queued[i++]);
    expect(store.create().code).toBe('AAAA');
    // Second draw repeats 'AAAA' (taken) so the store must retry and use 'BBBB'.
    expect(store.create().code).toBe('BBBB');
    expect(store.size).toBe(2);
  });

  it('returns undefined / false for unknown codes', () => {
    const store = new RoomStore();
    expect(store.get('ZZZZ')).toBeUndefined();
    expect(store.has('ZZZZ')).toBe(false);
  });
});

describe('RoomStore players (lobby)', () => {
  it('a new room starts with no players', () => {
    const store = new RoomStore();
    const room = store.create();
    expect(store.listPlayers(room.code)).toEqual([]);
  });

  it('join adds a player and lists it', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const result = store.join(code, 'sock-1', 'Alice');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.player).toEqual({ id: 'sock-1', nickname: 'Alice' });
    expect(store.listPlayers(code)).toEqual([{ id: 'sock-1', nickname: 'Alice' }]);
  });

  it('rejects joining an unknown room code', () => {
    const store = new RoomStore();
    const result = store.join('ZZZZ', 'sock-1', 'Alice');
    expect(result).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('trims the nickname and rejects empty / whitespace-only nicknames', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.join(code, 'sock-1', '   ')).toEqual({ ok: false, error: 'NICKNAME_REQUIRED' });
    const ok = store.join(code, 'sock-2', '  Bob  ');
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.player.nickname).toBe('Bob');
  });

  it(`blocks joining beyond ${MAX_PLAYERS} players with ROOM_FULL`, () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_PLAYERS; i++) {
      expect(store.join(code, `sock-${i}`, `P${i}`).ok).toBe(true);
    }
    expect(store.listPlayers(code)).toHaveLength(MAX_PLAYERS);
    expect(store.join(code, 'sock-extra', 'TooMany')).toEqual({ ok: false, error: 'ROOM_FULL' });
    expect(store.listPlayers(code)).toHaveLength(MAX_PLAYERS);
  });

  it('re-joining with the same player id does not duplicate and updates the nickname', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'sock-1', 'Alice');
    const again = store.join(code, 'sock-1', 'Alice2');
    expect(again.ok).toBe(true);
    expect(store.listPlayers(code)).toEqual([{ id: 'sock-1', nickname: 'Alice2' }]);
  });

  it('a full room still accepts a re-join from an existing player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_PLAYERS; i++) store.join(code, `sock-${i}`, `P${i}`);
    const rejoin = store.join(code, 'sock-0', 'P0-renamed');
    expect(rejoin.ok).toBe(true);
    expect(store.listPlayers(code)).toHaveLength(MAX_PLAYERS);
  });

  it('leave removes a player and frees a slot', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'sock-1', 'Alice');
    store.join(code, 'sock-2', 'Bob');
    expect(store.leave(code, 'sock-1')).toBe(true);
    expect(store.listPlayers(code)).toEqual([{ id: 'sock-2', nickname: 'Bob' }]);
    // Leaving an unknown player or room is a no-op.
    expect(store.leave(code, 'sock-1')).toBe(false);
    expect(store.leave('ZZZZ', 'sock-2')).toBe(false);
  });
});

describe('RoomStore.startGame', () => {
  // Fill a fresh room with `n` players and return its code.
  function roomWith(store: RoomStore, n: number): string {
    const { code } = store.create();
    for (let i = 0; i < n; i++) store.join(code, `sock-${i}`, `P${i}`);
    return code;
  }

  it('a new room starts in the LOBBY phase', () => {
    const store = new RoomStore();
    const room = store.create();
    expect(room.phase).toBe('LOBBY');
    expect(room.dilemmaCount).toBeNull();
  });

  it('starts the game with >= 3 players, moving LOBBY -> PHASE_INTRO', () => {
    const store = new RoomStore();
    const code = roomWith(store, MIN_PLAYERS_TO_START);
    const result = store.startGame(code, 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.room.phase).toBe('PHASE_INTRO');
      expect(result.room.dilemmaCount).toBe(5);
    }
    expect(store.get(code)?.phase).toBe('PHASE_INTRO');
  });

  it('accepts every allowed dilemma count', () => {
    for (const count of DILEMMA_COUNT_OPTIONS) {
      const store = new RoomStore();
      const code = roomWith(store, 3);
      expect(store.startGame(code, count).ok).toBe(true);
    }
  });

  it('rejects starting an unknown room', () => {
    const store = new RoomStore();
    expect(store.startGame('ZZZZ', 3)).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rejects starting with fewer than 3 players', () => {
    const store = new RoomStore();
    const code = roomWith(store, MIN_PLAYERS_TO_START - 1);
    expect(store.startGame(code, 3)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    expect(store.get(code)?.phase).toBe('LOBBY');
  });

  it('rejects a dilemma count outside 3/5/7', () => {
    const store = new RoomStore();
    const code = roomWith(store, 3);
    expect(store.startGame(code, 2)).toEqual({ ok: false, error: 'INVALID_DILEMMA_COUNT' });
    expect(store.startGame(code, 4)).toEqual({ ok: false, error: 'INVALID_DILEMMA_COUNT' });
    expect(store.startGame(code, 6)).toEqual({ ok: false, error: 'INVALID_DILEMMA_COUNT' });
    expect(store.get(code)?.phase).toBe('LOBBY');
  });

  it('rejects starting a game that already left the lobby', () => {
    const store = new RoomStore();
    const code = roomWith(store, 3);
    expect(store.startGame(code, 3).ok).toBe(true);
    expect(store.startGame(code, 5)).toEqual({ ok: false, error: 'ALREADY_STARTED' });
    // The original choice is preserved.
    expect(store.get(code)?.dilemmaCount).toBe(3);
  });

  it('initializes phase timing + dilemma index when the game starts', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000);
    const code = roomWith(store, 3);
    store.startGame(code, 3);
    const room = store.get(code);
    expect(room?.dilemmaIndex).toBe(0);
    // PHASE_INTRO has a timer: expiry = now + its duration.
    expect(room?.phaseExpiresAt).toBe(1_000 + PHASE_DURATIONS_MS.PHASE_INTRO!);
  });
});

describe('PHASE_DURATIONS_MS', () => {
  it('has no timer for LOBBY and FINAL_AWARDS, positive timers for the rest', () => {
    expect(PHASE_DURATIONS_MS.LOBBY).toBeNull();
    expect(PHASE_DURATIONS_MS.FINAL_AWARDS).toBeNull();
    const timed: GamePhase[] = [
      'PHASE_INTRO',
      'DILEMMA_REVEAL',
      'VOTE_1',
      'SPLIT_REVEAL',
      'DEFENSE',
      'VOTE_2',
      'PHASE_RESULTS',
    ];
    for (const phase of timed) {
      expect(PHASE_DURATIONS_MS[phase]).toBeGreaterThan(0);
    }
  });
});

describe('nextPhase (pure transition)', () => {
  it('walks one dilemma in order: PHASE_INTRO -> ... -> PHASE_RESULTS', () => {
    // dilemmaIndex 0 -> 1 when the first dilemma is revealed.
    expect(nextPhase('PHASE_INTRO', 0, 3)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 1 });
    expect(nextPhase('DILEMMA_REVEAL', 1, 3)).toEqual({ phase: 'VOTE_1', dilemmaIndex: 1 });
    expect(nextPhase('VOTE_1', 1, 3)).toEqual({ phase: 'SPLIT_REVEAL', dilemmaIndex: 1 });
    expect(nextPhase('SPLIT_REVEAL', 1, 3)).toEqual({ phase: 'DEFENSE', dilemmaIndex: 1 });
    expect(nextPhase('DEFENSE', 1, 3)).toEqual({ phase: 'VOTE_2', dilemmaIndex: 1 });
    expect(nextPhase('VOTE_2', 1, 3)).toEqual({ phase: 'PHASE_RESULTS', dilemmaIndex: 1 });
  });

  it('loops PHASE_RESULTS back to DILEMMA_REVEAL while dilemmas remain', () => {
    expect(nextPhase('PHASE_RESULTS', 1, 3)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 2 });
    expect(nextPhase('PHASE_RESULTS', 2, 3)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 3 });
  });

  it('goes to FINAL_AWARDS after the last dilemma', () => {
    expect(nextPhase('PHASE_RESULTS', 3, 3)).toEqual({ phase: 'FINAL_AWARDS', dilemmaIndex: 3 });
  });
});

describe('RoomStore.advancePhase', () => {
  function startedRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count);
    return code;
  }

  it('advances PHASE_INTRO -> DILEMMA_REVEAL and sets the next expiry', () => {
    let now = 5_000;
    const store = new RoomStore(generateRoomCode, () => now);
    const code = startedRoom(store);
    now = 9_000;
    const result = store.advancePhase(code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.room.phase).toBe('DILEMMA_REVEAL');
      expect(result.room.dilemmaIndex).toBe(1);
      expect(result.room.phaseExpiresAt).toBe(9_000 + PHASE_DURATIONS_MS.DILEMMA_REVEAL!);
    }
  });

  it('rejects advancing an unknown room', () => {
    const store = new RoomStore();
    expect(store.advancePhase('ZZZZ')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rejects advancing from LOBBY (start the game instead)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.advancePhase(code)).toEqual({ ok: false, error: 'NO_NEXT_PHASE' });
  });

  it('rejects advancing from the terminal FINAL_AWARDS phase', () => {
    const store = new RoomStore();
    const code = startedRoom(store, 3);
    // Advance all the way to FINAL_AWARDS.
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 100) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
    expect(store.advancePhase(code)).toEqual({ ok: false, error: 'NO_NEXT_PHASE' });
  });

  it('clears the expiry timestamp when entering FINAL_AWARDS', () => {
    const store = new RoomStore();
    const code = startedRoom(store, 3);
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 100) store.advancePhase(code);
    expect(store.get(code)?.phaseExpiresAt).toBeNull();
  });

  it('loops through every dilemma before reaching FINAL_AWARDS', () => {
    const store = new RoomStore();
    const code = startedRoom(store, 3);
    const reveals: number[] = [];
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 100) {
      store.advancePhase(code);
      const room = store.get(code);
      if (room?.phase === 'DILEMMA_REVEAL') reveals.push(room.dilemmaIndex);
    }
    // Exactly 3 dilemmas revealed, indexed 1..3.
    expect(reveals).toEqual([1, 2, 3]);
    expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
  });
});

describe('RoomStore dilemma reveal (US-007)', () => {
  function startedDeckRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count);
    return code;
  }

  it('does not reveal a dilemma until DILEMMA_REVEAL', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedDeckRoom(store);
    // Just started -> PHASE_INTRO, nothing revealed yet.
    expect(store.get(code)?.phase).toBe('PHASE_INTRO');
    expect(store.get(code)?.currentDilemma).toBeNull();
  });

  it('draws a dilemma when entering DILEMMA_REVEAL', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedDeckRoom(store);
    store.advancePhase(code); // PHASE_INTRO -> DILEMMA_REVEAL
    const room = store.get(code);
    expect(room?.phase).toBe('DILEMMA_REVEAL');
    expect(room?.currentDilemma).toEqual(DILEMMA_FIXTURE[0]);
  });

  it('keeps the same dilemma for the rest of the round (vote/split/defense)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedDeckRoom(store);
    store.advancePhase(code); // DILEMMA_REVEAL (d1)
    const d = store.get(code)?.currentDilemma;
    store.advancePhase(code); // VOTE_1
    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.get(code)?.currentDilemma).toEqual(d);
  });

  it('draws a fresh, non-repeating dilemma for each dilemma of the game', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedDeckRoom(store, 3);
    const revealed: string[] = [];
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 100) {
      store.advancePhase(code);
      const room = store.get(code);
      if (room?.phase === 'DILEMMA_REVEAL' && room.currentDilemma) {
        revealed.push(room.currentDilemma.id);
      }
    }
    expect(revealed).toEqual(['d1', 'd2', 'd3']);
    expect(new Set(revealed).size).toBe(3);
  });
});

describe('RoomStore voting (US-008)', () => {
  // Drive a fresh 3-player room into the VOTE_1 phase.
  function votingRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    return code;
  }

  it('a fresh room has no votes', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.voteCount(code)).toBe(0);
    expect(store.voteTally(code)).toEqual({ A: 0, B: 0 });
    expect(store.allVoted(code)).toBe(false);
  });

  it('records a player vote during VOTE_1', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    expect(store.get(code)?.phase).toBe('VOTE_1');
    const result = store.vote(code, 'sock-0', 'A');
    expect(result.ok).toBe(true);
    expect(store.voteCount(code)).toBe(1);
    expect(store.voteTally(code)).toEqual({ A: 1, B: 0 });
  });

  it('rejects voting outside a voting phase', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    expect(store.vote(code, 'sock-0', 'A')).toEqual({ ok: false, error: 'NOT_VOTING_PHASE' });
    store.advancePhase(code); // DILEMMA_REVEAL
    expect(store.vote(code, 'sock-0', 'A')).toEqual({ ok: false, error: 'NOT_VOTING_PHASE' });
  });

  it('rejects voting in an unknown room', () => {
    const store = new RoomStore();
    expect(store.vote('ZZZZ', 'sock-0', 'A')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rejects a vote from someone not in the room', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    expect(store.vote(code, 'intruder', 'A')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('rejects an invalid choice', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    expect(store.vote(code, 'sock-0', 'C')).toEqual({ ok: false, error: 'INVALID_CHOICE' });
  });

  it('lets a player change their vote, keeping a single vote', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-0', 'B');
    expect(store.voteCount(code)).toBe(1);
    expect(store.voteTally(code)).toEqual({ A: 0, B: 1 });
  });

  it('allVoted is false until every connected player has voted', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store); // 3 players
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    expect(store.allVoted(code)).toBe(false);
    store.vote(code, 'sock-2', 'A');
    expect(store.allVoted(code)).toBe(true);
  });

  it('a leaving non-voter lets the remaining voters complete the round', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store); // 3 players
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    expect(store.allVoted(code)).toBe(false);
    // The only non-voter leaves -> the two remaining have both voted.
    store.leave(code, 'sock-2');
    expect(store.voteCount(code)).toBe(2);
    expect(store.allVoted(code)).toBe(true);
  });

  it("drops a leaving voter's vote from the tally", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.leave(code, 'sock-0');
    expect(store.voteCount(code)).toBe(1);
    expect(store.voteTally(code)).toEqual({ A: 0, B: 1 });
  });

  it('keeps votes through the round but clears them for the next dilemma', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.voteCount(code)).toBe(2); // votes persist through the round
    // Walk the rest of the round (DEFENSE turns -> VOTE_2 -> PHASE_RESULTS) to
    // the next dilemma's reveal; the per-side defender turns make the number of
    // steps variable, so loop on the dilemma index rather than hardcoding it.
    let guard = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && guard++ < 100) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.voteCount(code)).toBe(0);
  });
});

describe('RoomStore split reveal (US-009)', () => {
  // Drive a fresh 3-player room into VOTE_1 with a known A:1 / B:2 split.
  function splitRoom(store: RoomStore): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    return code;
  }

  it('hides the A/B split while still voting (VOTE_1)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = splitRoom(store);
    expect(store.get(code)?.phase).toBe('VOTE_1');
    // The tally is computed internally but must NOT be public during the vote.
    expect(store.voteTally(code)).toEqual({ A: 1, B: 2 });
    expect(store.publicSplit(code)).toBeNull();
  });

  it('reveals the aggregate A/B split in SPLIT_REVEAL', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = splitRoom(store);
    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.get(code)?.phase).toBe('SPLIT_REVEAL');
    expect(store.publicSplit(code)).toEqual({ A: 1, B: 2 });
  });

  it('hides the split again once the reveal is over (DEFENSE)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = splitRoom(store);
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // DEFENSE
    expect(store.get(code)?.phase).toBe('DEFENSE');
    expect(store.publicSplit(code)).toBeNull();
  });

  it('returns null for an unknown room', () => {
    const store = new RoomStore();
    expect(store.publicSplit('ZZZZ')).toBeNull();
  });
});

describe('RoomStore defense (US-010)', () => {
  // Drive a fresh room into DEFENSE with a known split. Each entry of `sides`
  // is one player's secret vote; rng is injected so defender selection is
  // deterministic (the store's 4th ctor arg).
  function defenseRoom(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // DEFENSE
    return code;
  }

  it("auto-selects one defender per side from that side's voters", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    const room = store.get(code);
    expect(room?.phase).toBe('DEFENSE');
    // rng=()=>0 picks the first voter of each side: A -> sock-0, B -> sock-1.
    expect(room?.defenders).toEqual([
      { id: 'sock-0', nickname: 'P0', side: 'A' },
      { id: 'sock-1', nickname: 'P1', side: 'B' },
    ]);
  });

  it('skips a side with 0 votes (single defender)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']); // nobody picked B
    expect(store.get(code)?.defenders).toEqual([{ id: 'sock-0', nickname: 'P0', side: 'A' }]);
  });

  it('uses rng to choose which voter defends a multi-voter side', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.99);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    // rng ~> 1 picks the LAST voter of side B: sock-2 (not sock-1).
    const bDefender = store.get(code)?.defenders.find((d) => d.side === 'B');
    expect(bDefender?.id).toBe('sock-2');
  });

  it('runs defender turns in sequence before moving to VOTE_2', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // 2 defenders
    expect(store.get(code)?.defenseTurnIndex).toBe(0);
    store.advancePhase(code); // next defender turn, still DEFENSE
    expect(store.get(code)?.phase).toBe('DEFENSE');
    expect(store.get(code)?.defenseTurnIndex).toBe(1);
    store.advancePhase(code); // turns exhausted -> VOTE_2
    expect(store.get(code)?.phase).toBe('VOTE_2');
  });

  it('a single defender means a single turn then VOTE_2', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']); // 1 defender
    expect(store.get(code)?.defenseTurnIndex).toBe(0);
    store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('VOTE_2');
  });

  it('resets the per-turn timer when moving to the next defender', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.get(code)?.phaseExpiresAt).toBe(1_000 + PHASE_DURATIONS_MS.DEFENSE!);
    now = 50_000;
    store.advancePhase(code); // next turn
    expect(store.get(code)?.phaseExpiresAt).toBe(50_000 + PHASE_DURATIONS_MS.DEFENSE!);
  });

  it('exposes the current speaker + turn progress during DEFENSE', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.publicDefense(code)).toEqual({
      speaker: { id: 'sock-0', nickname: 'P0', side: 'A' },
      turn: 1,
      totalTurns: 2,
    });
    store.advancePhase(code); // next turn -> side B speaker
    expect(store.publicDefense(code)).toEqual({
      speaker: { id: 'sock-1', nickname: 'P1', side: 'B' },
      turn: 2,
      totalTurns: 2,
    });
    store.advancePhase(code); // VOTE_2 -> defense no longer public
    expect(store.publicDefense(code)).toBeNull();
  });

  it('does not expose defense info before DEFENSE (SPLIT_REVEAL)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.publicDefense(code)).toBeNull();
  });

  it('returns null defense for an unknown room', () => {
    const store = new RoomStore();
    expect(store.publicDefense('ZZZZ')).toBeNull();
  });

  it('handles a round with no votes (no defenders -> straight to VOTE_2)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1 (nobody votes)
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // DEFENSE (no defenders)
    expect(store.get(code)?.phase).toBe('DEFENSE');
    expect(store.publicDefense(code)).toEqual({ speaker: null, turn: 0, totalTurns: 0 });
    store.advancePhase(code); // -> VOTE_2
    expect(store.get(code)?.phase).toBe('VOTE_2');
  });
});

describe('RoomStore second vote + swing (US-011)', () => {
  // Drive a fresh room from the lobby all the way into VOTE_2 with a known
  // VOTE_1 split. rng=()=>0 makes defender selection deterministic so the
  // DEFENSE turn loop terminates predictably; loop on the phase to VOTE_2 since
  // the number of defense turns varies with how the side split.
  function vote2Room(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    let guard = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && guard++ < 10) store.advancePhase(code);
    return code;
  }

  it('treats VOTE_2 as a voting phase (but not the reveal phases)', () => {
    expect(isVotingPhase('VOTE_1')).toBe(true);
    expect(isVotingPhase('VOTE_2')).toBe(true);
    expect(isVotingPhase('SPLIT_REVEAL')).toBe(false);
    expect(isVotingPhase('DEFENSE')).toBe(false);
  });

  it('carries each first vote into VOTE_2 as the (changeable) default', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    expect(store.get(code)?.phase).toBe('VOTE_2');
    // The live tally equals the first vote until someone changes it.
    expect(store.voteTally(code)).toEqual({ A: 1, B: 2 });
    // A player can re-vote during VOTE_2.
    expect(store.vote(code, 'sock-1', 'A').ok).toBe(true);
    expect(store.voteTally(code)).toEqual({ A: 2, B: 1 });
  });

  it('begins VOTE_2 with every default vote already present', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    expect(store.voteCount(code)).toBe(3);
    expect(store.allVoted(code)).toBe(true);
  });

  it('computes zero swing when nobody changes their vote', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    const swing = store.computeSwing(code);
    expect(swing.first).toEqual({ A: 1, B: 2 });
    expect(swing.second).toEqual({ A: 1, B: 2 });
    expect(swing.switched).toBe(0);
    expect(swing.netSwing).toEqual({ A: 0, B: 0 });
  });

  it('counts a voter switching sides and the net swing toward each side', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']); // first: A=1 B=2
    store.vote(code, 'sock-1', 'A'); // sock-1 switches B -> A
    const swing = store.computeSwing(code);
    expect(swing.first).toEqual({ A: 1, B: 2 });
    expect(swing.second).toEqual({ A: 2, B: 1 });
    expect(swing.switched).toBe(1);
    expect(swing.netSwing).toEqual({ A: 1, B: -1 });
  });

  it('nets opposing switches so the swing cancels out', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'A', 'B', 'B']); // first: A=2 B=2
    store.vote(code, 'sock-0', 'B'); // A -> B
    store.vote(code, 'sock-2', 'A'); // B -> A
    const swing = store.computeSwing(code);
    expect(swing.first).toEqual({ A: 2, B: 2 });
    expect(swing.second).toEqual({ A: 2, B: 2 });
    expect(swing.switched).toBe(2);
    expect(swing.netSwing).toEqual({ A: 0, B: 0 });
  });

  it('keeps the first-vote snapshot immutable while VOTE_2 changes', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    store.vote(code, 'sock-2', 'A'); // change one VOTE_2 vote
    // `first` still reflects the original VOTE_1 split.
    expect(store.computeSwing(code).first).toEqual({ A: 1, B: 2 });
  });

  it('drops a leaving voter from both the first and second tallies', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    store.leave(code, 'sock-2'); // a B voter leaves during VOTE_2
    const swing = store.computeSwing(code);
    expect(swing.first).toEqual({ A: 1, B: 1 });
    expect(swing.second).toEqual({ A: 1, B: 1 });
    expect(swing.switched).toBe(0);
  });

  it('resets the first-vote snapshot for the next dilemma', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = vote2Room(store, ['A', 'B', 'B']);
    let guard = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && guard++ < 20) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.computeSwing(code)).toEqual({
      first: { A: 0, B: 0 },
      second: { A: 0, B: 0 },
      switched: 0,
      netSwing: { A: 0, B: 0 },
    });
  });

  it('returns zeros for an unknown room', () => {
    const store = new RoomStore();
    expect(store.computeSwing('ZZZZ')).toEqual({
      first: { A: 0, B: 0 },
      second: { A: 0, B: 0 },
      switched: 0,
      netSwing: { A: 0, B: 0 },
    });
  });
});

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
