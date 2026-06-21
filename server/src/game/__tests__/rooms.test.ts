import { describe, it, expect } from 'vitest';
import {
  RoomStore,
  generateRoomCode,
  nextPhase,
  nextDuelPhase,
  isVotingPhase,
  PHASE_DURATIONS_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  DILEMMA_COUNT_OPTIONS,
  type GamePhase,
  type VoteChoice,
} from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

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
  spuntiA: [`pro A${i + 1} #1`, `pro A${i + 1} #2`],
  spuntiB: [`pro B${i + 1} #1`, `pro B${i + 1} #2`],
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

// helper: spin up a 2-human duel and advance to the first DUEL_PICK.
function startDuel(store: RoomStore, code: string) {
  store.create();
  store.join(code, 'p1', 'Ann');
  store.join(code, 'p2', 'Bob');
  store.startGame(code, 3, 'misto', 'duello'); // PHASE_INTRO
  store.advancePhase(code); // -> DUEL_PICK (idx 1, dilemma drawn)
}

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
      argument: null,
      spunti: ['pro A1 #1', 'pro A1 #2'],
    });
    store.advancePhase(code); // next turn -> side B speaker
    expect(store.publicDefense(code)).toEqual({
      speaker: { id: 'sock-1', nickname: 'P1', side: 'B' },
      turn: 2,
      totalTurns: 2,
      argument: null,
      spunti: ['pro B1 #1', 'pro B1 #2'],
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
    expect(store.publicDefense(code)).toEqual({ speaker: null, turn: 0, totalTurns: 0, argument: null, spunti: null });
    store.advancePhase(code); // -> VOTE_2
    expect(store.get(code)?.phase).toBe('VOTE_2');
  });

  it("exposes the speaking side's spunti during DEFENSE", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // defenders: A=sock-0, B=sock-1
    // First DEFENSE turn speaks side A -> d1.spuntiA.
    expect(store.publicDefense(code)?.spunti).toEqual(['pro A1 #1', 'pro A1 #2']);
    store.advancePhase(code); // next DEFENSE turn -> side B
    expect(store.publicDefense(code)?.spunti).toEqual(['pro B1 #1', 'pro B1 #2']);
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

describe('RoomStore per-player stats (Fase A)', () => {
  // Drive a started room through one full dilemma round, applying the given
  // first votes (VOTE_1) and optional re-votes (VOTE_2), landing on PHASE_RESULTS
  // (where round stats are recorded). Works from PHASE_INTRO or a prior
  // PHASE_RESULTS, so it can be chained to play several rounds in a row.
  function playRound(
    store: RoomStore,
    code: string,
    vote1: Record<string, VoteChoice>,
    vote2: Record<string, VoteChoice> = {},
  ): void {
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    for (const [id, side] of Object.entries(vote1)) store.vote(code, id, side);
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    for (const [id, side] of Object.entries(vote2)) store.vote(code, id, side);
    store.advancePhase(code); // VOTE_2 -> PHASE_RESULTS (records stats)
  }

  function startedStatsRoom(store: RoomStore, players = 3, dilemmaCount = 3): string {
    const { code } = store.create();
    for (let i = 0; i < players; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, dilemmaCount);
    return code;
  }

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

  it('a freshly started game has empty per-player stats', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = startedStatsRoom(store);
    expect(store.get(code)?.stats.size).toBe(0);
  });

  it('records rounds, changes, majority/minority and persuasion on entry to PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = startedStatsRoom(store);
    // VOTE_1 A=1(sock-0) B=2(sock-1,sock-2); defenders A->sock-0, B->sock-1.
    // sock-1 switches B->A => second A=2 B=1 (majority A), netSwing A=+1 B=-1.
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'B', 'sock-2': 'B' }, { 'sock-1': 'A' });
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')).toEqual({ rounds: 1, changedCount: 0, majorityCount: 1, minorityCount: 0, persuasion: 1, defendedCount: 1 });
    expect(stats.get('sock-1')).toEqual({ rounds: 1, changedCount: 1, majorityCount: 1, minorityCount: 0, persuasion: 0, defendedCount: 1 });
    expect(stats.get('sock-2')).toEqual({ rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 1, persuasion: 0, defendedCount: 0 });
  });

  it('does not credit majority or minority on a tied second vote', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = startedStatsRoom(store, 4);
    // 2-2 tie, nobody changes -> neither side is the majority.
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'B', 'sock-3': 'B' });
    const stats = store.get(code)!.stats;
    for (const id of ['sock-0', 'sock-1', 'sock-2', 'sock-3']) {
      expect(stats.get(id)?.majorityCount).toBe(0);
      expect(stats.get(id)?.minorityCount).toBe(0);
    }
  });

  it('accumulates stats across multiple rounds', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = startedStatsRoom(store);
    // Round 1: as above (sock-1 switches to A).
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'B', 'sock-2': 'B' }, { 'sock-1': 'A' });
    // Round 2: everyone votes A, nobody changes -> majority A, no swing.
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'A' });
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')).toEqual({ rounds: 2, changedCount: 0, majorityCount: 2, minorityCount: 0, persuasion: 1, defendedCount: 2 });
    expect(stats.get('sock-1')).toEqual({ rounds: 2, changedCount: 1, majorityCount: 2, minorityCount: 0, persuasion: 0, defendedCount: 1 });
    expect(stats.get('sock-2')).toEqual({ rounds: 2, changedCount: 0, majorityCount: 1, minorityCount: 1, persuasion: 0, defendedCount: 0 });
  });

  it('counts a round each defender defended (defendedCount)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // defenders: sock-0 (A), sock-1 (B)
    let guard = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && guard++ < 20) store.advancePhase(code);
    expect(store.get(code)?.stats.get('sock-0')?.defendedCount).toBe(1);
    expect(store.get(code)?.stats.get('sock-1')?.defendedCount).toBe(1);
    expect(store.get(code)?.stats.get('sock-2')?.defendedCount ?? 0).toBe(0);
  });
});

describe('RoomStore public swing (Fase A)', () => {
  function swingResultsRoom(store: RoomStore): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-1', 'A'); // B -> A
    store.advancePhase(code); // -> PHASE_RESULTS
    return code;
  }

  it('hides the swing outside PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    expect(store.publicSwing(code)).toBeNull();
    expect(store.publicSwing('ZZZZ')).toBeNull();
  });

  it('reveals the swing + per-defender attribution in PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = swingResultsRoom(store);
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
    const swing = store.publicSwing(code);
    expect(swing?.first).toEqual({ A: 1, B: 2 });
    expect(swing?.second).toEqual({ A: 2, B: 1 });
    expect(swing?.switched).toBe(1);
    expect(swing?.netSwing).toEqual({ A: 1, B: -1 });
    // Only the side that gained votes is attributed to its defender.
    expect(swing?.attribution).toEqual([
      { defender: { id: 'sock-0', nickname: 'P0', side: 'A' }, votes: 1 },
    ]);
  });
});

describe('RoomStore awards (Fase A)', () => {
  // Join 3 players and inject a known stats map, so award selection is tested
  // independently of how the stats were accumulated.
  function roomWithStats(
    store: RoomStore,
    stats: Record<string, { rounds: number; changedCount: number; majorityCount: number; minorityCount: number; persuasion: number }>,
  ): string {
    const { code } = store.create();
    for (const id of Object.keys(stats)) store.join(code, id, id.toUpperCase());
    const room = store.get(code)!;
    room.stats = new Map(Object.entries(stats));
    return code;
  }

  it('awards each persuasion-themed superlative to its leader', () => {
    const store = new RoomStore();
    const code = roomWithStats(store, {
      'sock-0': { rounds: 3, changedCount: 0, majorityCount: 3, minorityCount: 0, persuasion: 0 },
      'sock-1': { rounds: 3, changedCount: 3, majorityCount: 0, minorityCount: 3, persuasion: 5 },
      'sock-2': { rounds: 3, changedCount: 1, majorityCount: 1, minorityCount: 0, persuasion: 2 },
    });
    const byId = Object.fromEntries(store.computeAwards(code).map((a) => [a.id, a.winner]));
    expect(byId['persuasore']).toEqual({ id: 'sock-1', nickname: 'SOCK-1' });
    expect(byId['banderuola']).toEqual({ id: 'sock-1', nickname: 'SOCK-1' });
    expect(byId['roccione']).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });
    expect(byId['sintonia']).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });
    expect(byId['bastian']).toEqual({ id: 'sock-1', nickname: 'SOCK-1' });
  });

  it('omits an award with no meaningful winner', () => {
    const store = new RoomStore();
    const code = roomWithStats(store, {
      'sock-0': { rounds: 2, changedCount: 0, majorityCount: 2, minorityCount: 0, persuasion: 0 },
      'sock-1': { rounds: 2, changedCount: 0, majorityCount: 2, minorityCount: 0, persuasion: 0 },
    });
    const ids = store.computeAwards(code).map((a) => a.id);
    // Nobody persuaded, changed sides, or was ever in the minority.
    expect(ids).not.toContain('persuasore');
    expect(ids).not.toContain('banderuola');
    expect(ids).not.toContain('bastian');
  });

  it('breaks ties by join order', () => {
    const store = new RoomStore();
    const code = roomWithStats(store, {
      'sock-0': { rounds: 3, changedCount: 2, majorityCount: 0, minorityCount: 0, persuasion: 0 },
      'sock-1': { rounds: 3, changedCount: 2, majorityCount: 0, minorityCount: 0, persuasion: 0 },
    });
    const banderuola = store.computeAwards(code).find((a) => a.id === 'banderuola');
    expect(banderuola?.winner).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });
  });

  it('gates publicAwards to FINAL_AWARDS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.publicAwards(code)).toBeNull(); // PHASE_INTRO
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 100) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
    expect(Array.isArray(store.publicAwards(code))).toBe(true);
    expect(store.publicAwards('ZZZZ')).toBeNull();
  });
});

describe('RoomStore bots (Fase B)', () => {
  function lobbyWith(store: RoomStore, humans: number, bots: number): string {
    const { code } = store.create();
    for (let i = 0; i < humans; i++) store.join(code, `sock-${i}`, `H${i}`);
    for (let i = 0; i < bots; i++) store.addBot(code);
    return code;
  }

  it('adds a bot that counts as a player and is flagged isBot with a persona', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const res = store.addBot(code, 'roccione');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.player.isBot).toBe(true);
      expect(res.player.persona).toBe('roccione');
    }
    const list = store.listPlayers(code);
    expect(list).toHaveLength(1);
    expect(list[0].isBot).toBe(true);
  });

  it('removes a bot but not a human', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    const bot = store.addBot(code);
    const botId = bot.ok ? bot.player.id : '';
    expect(store.removeBot(code, 'sock-0')).toBe(false); // a human is not removable as a bot
    expect(store.removeBot(code, botId)).toBe(true);
    expect(store.listPlayers(code)).toEqual([{ id: 'sock-0', nickname: 'H0' }]);
  });

  it('rejects adding a bot when full or already started', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_PLAYERS; i++) store.join(code, `s${i}`, `H${i}`);
    expect(store.addBot(code)).toEqual({ ok: false, error: 'ROOM_FULL' });

    const store2 = new RoomStore();
    const c2 = lobbyWith(store2, 3, 0);
    store2.startGame(c2, 3);
    expect(store2.addBot(c2)).toEqual({ ok: false, error: 'ALREADY_STARTED' });
  });

  it('starts a solo game: 1 human + 2 bots', () => {
    const store = new RoomStore();
    const code = lobbyWith(store, 1, 2);
    expect(store.startGame(code, 3).ok).toBe(true);
  });

  it('still requires 3 total participants', () => {
    const store = new RoomStore();
    const code = lobbyWith(store, 1, 1);
    expect(store.startGame(code, 3)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
  });

  it('refuses a bots-only game (needs at least one human)', () => {
    const store = new RoomStore();
    const code = lobbyWith(store, 0, 3);
    expect(store.startGame(code, 3)).toEqual({ ok: false, error: 'NO_HUMAN_PLAYERS' });
  });

  it('casts bot first votes on entry to VOTE_1', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = lobbyWith(store, 1, 2); // rng=0 -> bots vote A
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    // Both bots have already voted A; the human hasn't voted yet.
    expect(store.voteCount(code)).toBe(2);
    expect(store.voteTally(code)).toEqual({ A: 2, B: 0 });
  });

  // Drive a 2-human + 1-bot room to VOTE_2 with a known first-vote split, then
  // read the bot's (possibly swung) second vote. rng=0 is deterministic.
  function botSecondVote(persona: string, botFirst: VoteChoice, humanVotes: VoteChoice[]): VoteChoice | undefined {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    humanVotes.forEach((_, i) => store.join(code, `sock-${i}`, `H${i}`));
    const bot = store.addBot(code, persona);
    const botId = bot.ok ? bot.player.id : '';
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    humanVotes.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.vote(code, botId, botFirst); // override the bot's random first vote
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    return store.get(code)?.votes.get(botId);
  }

  it('roccione never changes its vote', () => {
    expect(botSecondVote('roccione', 'B', ['A', 'A'])).toBe('B'); // majority A, stays B
  });
  it('gregge switches to the majority side', () => {
    expect(botSecondVote('gregge', 'B', ['A', 'A'])).toBe('A');
  });
  it('bastian contrario switches to the minority side', () => {
    expect(botSecondVote('bastian', 'A', ['A', 'A'])).toBe('B'); // on majority -> flips to minority
  });
  it('indeciso flips when the rng says so', () => {
    expect(botSecondVote('indeciso', 'B', ['A', 'A'])).toBe('A'); // rng=0 < flip threshold
  });

  it('stores a templated argument when a bot is the defender', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.join(code, 'sock-1', 'H1');
    const bot = store.addBot(code, 'roccione');
    const botId = bot.ok ? bot.player.id : '';
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, botId, 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // DEFENSE — defenders: A (human sock-0) then B (bot)
    const t1 = store.publicDefense(code);
    expect(t1?.speaker?.id).toBe('sock-0');
    expect(t1?.argument).toBeNull(); // a human speaks aloud, no canned text
    store.advancePhase(code); // bot's turn
    const t2 = store.publicDefense(code);
    expect(t2?.speaker?.id).toBe(botId);
    expect(typeof t2?.argument).toBe('string');
    expect((t2?.argument ?? '').length).toBeGreaterThan(0);
  });
});

describe('RoomStore bot defender AI hooks (Fase C)', () => {
  // 2 humans on A, 1 bot on B -> defenders [A: sock-0 (human), B: bot]. Lands on
  // DEFENSE turn 0 (the human); advance once to reach the bot's turn.
  function botDefenseRoom(store: RoomStore): { code: string; botId: string } {
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.join(code, 'sock-1', 'H1');
    const bot = store.addBot(code, 'roccione');
    const botId = bot.ok ? bot.player.id : '';
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, botId, 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // DEFENSE (turn 0 = human on A)
    return { code, botId };
  }

  it('exposes the current bot defender context only at the bot turn', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code, botId } = botDefenseRoom(store);
    expect(store.publicDefense(code)?.speaker?.id).toBe('sock-0');
    expect(store.botDefenderContext(code)).toBeNull(); // human turn
    store.advancePhase(code); // bot's turn
    expect(store.publicDefense(code)?.speaker?.id).toBe(botId);
    const ctx = store.botDefenderContext(code);
    expect(ctx?.persona).toBe('roccione');
    expect(ctx?.side).toBe('B');
    expect(ctx?.dilemma.id).toBe('d1');
    expect(ctx?.dilemmaIndex).toBe(1);
    expect(ctx?.defenseTurnIndex).toBe(1);
  });

  it('has no bot defender context outside DEFENSE or for unknown rooms', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = botDefenseRoom(store);
    store.advancePhase(code); // bot turn
    store.advancePhase(code); // -> VOTE_2
    expect(store.botDefenderContext(code)).toBeNull();
    expect(store.botDefenderContext('ZZZZ')).toBeNull();
  });

  it('applies the AI argument only for the matching DEFENSE turn', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = botDefenseRoom(store);
    store.advancePhase(code); // bot turn (dilemmaIndex 1, defenseTurnIndex 1)
    expect(store.setBotDefenseArgument(code, 1, 0, 'stale turn')).toBe(false);
    expect(store.setBotDefenseArgument(code, 2, 1, 'wrong dilemma')).toBe(false);
    expect(store.setBotDefenseArgument(code, 1, 1, 'Argomento AI')).toBe(true);
    expect(store.publicDefense(code)?.argument).toBe('Argomento AI');
  });

  it('rejects the AI argument outside DEFENSE / unknown room', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = botDefenseRoom(store);
    store.advancePhase(code); // bot turn
    store.advancePhase(code); // -> VOTE_2
    expect(store.setBotDefenseArgument(code, 1, 1, 'nope')).toBe(false);
    expect(store.setBotDefenseArgument('ZZZZ', 1, 1, 'nope')).toBe(false);
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

describe('RoomStore duel mode', () => {
  it('create() defaults mode to gruppo', () => {
    const store = new RoomStore(() => 'AAAA');
    expect(store.create().mode).toBe('gruppo');
  });

  it('startGame duello requires exactly 2 human players', () => {
    const store = new RoomStore(() => 'BBBB');
    store.create();
    store.join('BBBB', 'p1', 'Ann');
    expect(store.startGame('BBBB', 3, 'misto', 'duello')).toEqual({ ok: false, error: 'WRONG_PLAYER_COUNT' });
    store.join('BBBB', 'p2', 'Bob');
    const ok = store.startGame('BBBB', 3, 'misto', 'duello');
    expect(ok.ok).toBe(true);
    expect(store.get('BBBB')!.mode).toBe('duello');
    expect(store.get('BBBB')!.phase).toBe('PHASE_INTRO');
  });

  it('startGame duello rejects 3 players', () => {
    const store = new RoomStore(() => 'CCCC');
    store.create();
    for (const id of ['a', 'b', 'c']) store.join('CCCC', id, id);
    expect(store.startGame('CCCC', 3, 'misto', 'duello')).toEqual({ ok: false, error: 'WRONG_PLAYER_COUNT' });
  });
});

describe('nextDuelPhase', () => {
  it('walks the duel sequence (differ path)', () => {
    expect(nextDuelPhase('PHASE_INTRO', 0, 3, false)).toEqual({ phase: 'DUEL_PICK', dilemmaIndex: 1 });
    expect(nextDuelPhase('DUEL_PICK', 1, 3, false)).toEqual({ phase: 'DUEL_REVEAL', dilemmaIndex: 1 });
    expect(nextDuelPhase('DUEL_REVEAL', 1, 3, false)).toEqual({ phase: 'DUEL_ARGUE', dilemmaIndex: 1 });
    expect(nextDuelPhase('DUEL_ARGUE', 1, 3, false)).toEqual({ phase: 'DUEL_REPICK', dilemmaIndex: 1 });
    expect(nextDuelPhase('DUEL_REPICK', 1, 3, false)).toEqual({ phase: 'DUEL_RESULT', dilemmaIndex: 1 });
  });

  it('skips argue/repick when agreed', () => {
    expect(nextDuelPhase('DUEL_REVEAL', 1, 3, true)).toEqual({ phase: 'DUEL_RESULT', dilemmaIndex: 1 });
  });

  it('loops then ends at FINAL_DUEL', () => {
    expect(nextDuelPhase('DUEL_RESULT', 1, 3, false)).toEqual({ phase: 'DUEL_PICK', dilemmaIndex: 2 });
    expect(nextDuelPhase('DUEL_RESULT', 3, 3, false)).toEqual({ phase: 'FINAL_DUEL', dilemmaIndex: 3 });
  });
});

describe('duel round (advancePhase)', () => {
  it('differ -> argue (2 turns) -> repick flip credits the persuader', () => {
    const store = new RoomStore(() => 'DDDD', () => 1000, makeFixtureDeck, () => 0);
    startDuel(store, 'DDDD');
    expect(store.get('DDDD')!.phase).toBe('DUEL_PICK');
    store.vote('DDDD', 'p1', 'A');
    store.vote('DDDD', 'p2', 'B');
    store.advancePhase('DDDD'); // -> DUEL_REVEAL
    expect(store.get('DDDD')!.phase).toBe('DUEL_REVEAL');
    store.advancePhase('DDDD'); // differ -> DUEL_ARGUE turn 0
    expect(store.get('DDDD')!.phase).toBe('DUEL_ARGUE');
    expect(store.get('DDDD')!.duelTurnIndex).toBe(0);
    store.advancePhase('DDDD'); // DUEL_ARGUE turn 1
    expect(store.get('DDDD')!.phase).toBe('DUEL_ARGUE');
    expect(store.get('DDDD')!.duelTurnIndex).toBe(1);
    store.advancePhase('DDDD'); // -> DUEL_REPICK (votes1 snapshot)
    expect(store.get('DDDD')!.phase).toBe('DUEL_REPICK');
    store.vote('DDDD', 'p1', 'B'); // p1 flips -> Bob (p2) convinced p1
    store.advancePhase('DDDD'); // -> DUEL_RESULT (record)
    expect(store.get('DDDD')!.phase).toBe('DUEL_RESULT');
    expect(store.get('DDDD')!.duelScore.get('p2')).toBe(1);
    expect(store.get('DDDD')!.duelScore.get('p1') ?? 0).toBe(0);
  });

  it('agree -> skip argue/repick, agreements incremented', () => {
    const store = new RoomStore(() => 'EEEE', () => 1000, makeFixtureDeck, () => 0);
    startDuel(store, 'EEEE');
    store.vote('EEEE', 'p1', 'A');
    store.vote('EEEE', 'p2', 'A'); // agree
    store.advancePhase('EEEE'); // -> DUEL_REVEAL
    store.advancePhase('EEEE'); // agreed -> DUEL_RESULT
    expect(store.get('EEEE')!.phase).toBe('DUEL_RESULT');
    expect(store.get('EEEE')!.duelAgreements).toBe(1);
  });
});

describe('duel public readers', () => {
  it('vote() accepts picks in DUEL_PICK and DUEL_REPICK', () => {
    expect(isVotingPhase('DUEL_PICK')).toBe(true);
    expect(isVotingPhase('DUEL_REPICK')).toBe(true);
  });

  it('publicDuelReveal exposes both picks only in DUEL_REVEAL; turn in DUEL_ARGUE', () => {
    const store = new RoomStore(() => 'FFFF', () => 1000, makeFixtureDeck, () => 0);
    startDuel(store, 'FFFF');
    store.vote('FFFF', 'p1', 'A');
    store.vote('FFFF', 'p2', 'B');
    expect(store.publicDuelReveal('FFFF')).toBeNull(); // still DUEL_PICK
    store.advancePhase('FFFF'); // DUEL_REVEAL
    const rev = store.publicDuelReveal('FFFF')!;
    expect(rev.agreed).toBe(false);
    expect(rev.picks).toHaveLength(2);
    store.advancePhase('FFFF'); // DUEL_ARGUE
    expect(store.publicDuelReveal('FFFF')).toBeNull();
    const turn = store.publicDuelTurn('FFFF')!;
    expect(turn.totalTurns).toBe(2);
    expect(turn.speaker?.side).toBe('A'); // first player picked A
  });

  it('publicDuelResult lists who convinced whom only in DUEL_RESULT', () => {
    const store = new RoomStore(() => 'HHHH', () => 1000, makeFixtureDeck, () => 0);
    startDuel(store, 'HHHH');
    store.vote('HHHH', 'p1', 'A');
    store.vote('HHHH', 'p2', 'B');
    store.advancePhase('HHHH'); // REVEAL
    store.advancePhase('HHHH'); // ARGUE t0
    store.advancePhase('HHHH'); // ARGUE t1
    store.advancePhase('HHHH'); // REPICK
    store.vote('HHHH', 'p1', 'B'); // p1 flips
    store.advancePhase('HHHH'); // RESULT
    const res = store.publicDuelResult('HHHH')!;
    expect(res.agreed).toBe(false);
    expect(res.convinced).toHaveLength(1);
    expect(res.convinced[0].persuader.id).toBe('p2');
    expect(res.convinced[0].convinced.id).toBe('p1');
  });

  it('publicDuelSummary only at FINAL_DUEL', () => {
    const store = new RoomStore(() => 'GGGG', () => 1000, makeFixtureDeck, () => 0);
    startDuel(store, 'GGGG');
    expect(store.publicDuelSummary('GGGG')).toBeNull();
  });
});

describe('RoomStore reconnection / connected state', () => {
  // Drive a fresh 3-player room into VOTE_1 (mirror of the vote suite helper).
  function votingRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    return code;
  }

  it('setConnected marks a player absent without removing them, then restores', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');

    expect(store.setConnected(code, 'p1', false)).toBe(true);
    // Still in the room (slot held during the grace period), just flagged absent.
    expect(store.listPlayers(code)).toHaveLength(2);
    expect(store.get(code)?.players.get('p1')?.connected).toBe(false);

    // Reconnecting clears the flag (default = connected).
    expect(store.setConnected(code, 'p1', true)).toBe(true);
    expect(store.get(code)?.players.get('p1')?.connected ?? true).toBe(true);
  });

  it('setConnected returns false for unknown room or player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.setConnected('ZZZZ', 'p1', false)).toBe(false);
    expect(store.setConnected(code, 'ghost', false)).toBe(false);
  });

  it('a freshly joined player is connected (no connected field set)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const res = store.join(code, 'p1', 'Ann');
    expect(res.ok).toBe(true);
    expect(store.get(code)?.players.get('p1')?.connected ?? true).toBe(true);
  });

  it('allVoted ignores disconnected non-voters', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    expect(store.allVoted(code)).toBe(false); // sock-2 still connected, hasn't voted

    store.setConnected(code, 'sock-2', false);
    expect(store.allVoted(code)).toBe(true); // the only non-voter is now absent

    // Reconnecting a non-voter makes the round wait for them again.
    store.setConnected(code, 'sock-2', true);
    expect(store.allVoted(code)).toBe(false);
  });

  it('allVoted is false when every player is disconnected', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    for (let i = 0; i < 3; i++) store.setConnected(code, `sock-${i}`, false);
    expect(store.allVoted(code)).toBe(false);
  });

  it('a disconnect → reconnect keeps the secret vote intact', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = votingRoom(store);
    store.vote(code, 'sock-0', 'A');
    expect(store.voteCount(code)).toBe(1);

    store.setConnected(code, 'sock-0', false);
    store.setConnected(code, 'sock-0', true);
    expect(store.voteCount(code)).toBe(1); // vote preserved across the blip

    // Re-joining with the same id (what index.ts does on reconnect) also keeps it.
    store.join(code, 'sock-0', 'P0');
    expect(store.voteCount(code)).toBe(1);
  });

  it('re-joining clears a stale disconnected flag', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.setConnected(code, 'p1', false);
    const again = store.join(code, 'p1', 'Ann');
    expect(again.ok).toBe(true);
    expect(store.get(code)?.players.get('p1')?.connected ?? true).toBe(true);
  });
});
