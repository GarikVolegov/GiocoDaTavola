import { describe, it, expect } from 'vitest';
import {
  RoomStore,
  generateRoomCode,
  nextPhase,
  nextDuelPhase,
  isVotingPhase,
  PHASE_DURATIONS_MS,
  MAX_PLAYERS,
  MAX_GIOCATORI,
  NICKNAME_MAX,
  MIN_PLAYERS_TO_START,
  DILEMMA_COUNT_OPTIONS,
  REACTIONS,
  REACTION_MIN_INTERVAL_MS,
  DEFENSE_MIN_MS,
  INTERVENTO_MIN_MS,
  DEFENSE_MAX_MS_NORMALE,
  DEFENSE_MAX_MS_LUNGA,
  INTERVENTI_MAX_MS,
  TURN_BOT_MS,
  isInterventiPhase,
  type GamePhase,
  type VoteChoice,
} from '../rooms';
import { Deck, type Dilemma, type ContentRegister, type Complessita } from '../deck';

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

// helper: drive a fresh room into DEFENSE with a known split. Each entry of
// `sides` is one player's secret vote; rng is injected so defender selection
// is deterministic (the store's 4th ctor arg). `dilemmaCount` defaults to 3
// (the devil round then always lands on round 2, its penultimate — 6.2).
function defenseRoom(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B'], dilemmaCount = 3): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, dilemmaCount); // PHASE_INTRO
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  store.advancePhase(code); // DEFENSE
  return code;
}

// From a DEFENSE state, walk to the NEXT round's DEFENSE, re-casting VOTE_1
// votes for sock-0..n (votes are cleared each DILEMMA_REVEAL, so re-vote).
function nextDefense(store: RoomStore, code: string, sides: VoteChoice[]) {
  let g = 0;
  while (store.get(code)?.phase !== 'VOTE_1' && g++ < 50) store.advancePhase(code);
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  g = 0;
  while (store.get(code)?.phase !== 'DEFENSE' && g++ < 50) store.advancePhase(code);
}

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

  it('caps an over-long nickname to NICKNAME_MAX chars', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const res = store.join(code, 'sock-1', 'x'.repeat(100));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.player.nickname.length).toBe(NICKNAME_MAX);
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

  it(`assigns 'pubblico' to the ${MAX_GIOCATORI + 1}th joiner onward, up to ${MAX_PLAYERS} total`, () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_GIOCATORI; i++) {
      const res = store.join(code, `g${i}`, `G${i}`);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.player.role).toBeUndefined(); // absent = giocatore
    }
    for (let i = MAX_GIOCATORI; i < MAX_PLAYERS; i++) {
      const res = store.join(code, `p${i}`, `P${i}`);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.player.role).toBe('pubblico');
    }
    expect(store.listPlayers(code)).toHaveLength(MAX_PLAYERS);
    expect(store.join(code, 'overflow', 'Overflow')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('a re-join keeps the existing role unchanged', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_GIOCATORI; i++) store.join(code, `g${i}`, `G${i}`);
    store.join(code, 'pub1', 'Pub1');
    const rejoin = store.join(code, 'pub1', 'Pub1 renamed');
    expect(rejoin.ok).toBe(true);
    if (rejoin.ok) {
      expect(rejoin.player.role).toBe('pubblico');
      expect(rejoin.player.nickname).toBe('Pub1 renamed');
    }
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
  it('has no timer for LOBBY/FINAL_AWARDS and the self-paced vote phases', () => {
    expect(PHASE_DURATIONS_MS.LOBBY).toBeNull();
    expect(PHASE_DURATIONS_MS.FINAL_AWARDS).toBeNull();
    // Self-paced: advance on "everyone acted", not on a timer.
    expect(PHASE_DURATIONS_MS.VOTE_1).toBeNull();
    expect(PHASE_DURATIONS_MS.VOTE_2).toBeNull();
    expect(PHASE_DURATIONS_MS.PREDICT).toBeNull();
    expect(PHASE_DURATIONS_MS.SPEAKER_VOTE).toBeNull();
    const timed: GamePhase[] = [
      'PHASE_INTRO',
      'DILEMMA_REVEAL',
      'SPLIT_REVEAL',
      'DEFENSE',
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
    expect(nextPhase('SPLIT_REVEAL', 1, 3)).toEqual({ phase: 'PREDICT', dilemmaIndex: 1 });
    expect(nextPhase('PREDICT', 1, 3)).toEqual({ phase: 'DEFENSE', dilemmaIndex: 1 });
    expect(nextPhase('DEFENSE', 1, 3)).toEqual({ phase: 'VOTE_2', dilemmaIndex: 1 });
    expect(nextPhase('VOTE_2', 1, 3)).toEqual({ phase: 'SPEAKER_VOTE', dilemmaIndex: 1 });
    expect(nextPhase('SPEAKER_VOTE', 1, 3)).toEqual({ phase: 'PHASE_RESULTS', dilemmaIndex: 1 });
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
    store.advancePhase(code); // PREDICT
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
      kind: 'defense',
      speaker: { id: 'sock-0', nickname: 'P0', side: 'A' },
      intervenor: null,
      speakerId: 'sock-0',
      turn: 1,
      totalTurns: 2,
      argument: null,
      spunti: ['pro A1 #1', 'pro A1 #2'],
      raisedCount: 0,
      queue: null,
      minEndsAt: 30_000,
      canFinish: false,
      startedAt: 0,
    });
    store.advancePhase(code); // next turn -> side B speaker
    expect(store.publicDefense(code)).toEqual({
      kind: 'defense',
      speaker: { id: 'sock-1', nickname: 'P1', side: 'B' },
      intervenor: null,
      speakerId: 'sock-1',
      turn: 2,
      totalTurns: 2,
      argument: null,
      spunti: ['pro B1 #1', 'pro B1 #2'],
      raisedCount: 0,
      queue: null,
      minEndsAt: 30_000,
      canFinish: false,
      startedAt: 0,
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
    store.advancePhase(code); // PREDICT
    store.advancePhase(code); // DEFENSE (no defenders)
    expect(store.get(code)?.phase).toBe('DEFENSE');
    expect(store.publicDefense(code)).toEqual({
      kind: 'defense',
      speaker: null,
      intervenor: null,
      speakerId: null,
      turn: 0,
      totalTurns: 0,
      argument: null,
      spunti: null,
      raisedCount: 0,
      queue: null,
      minEndsAt: null,
      canFinish: true,
      startedAt: 0,
    });
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
    // VOTE_2 -> ... -> PHASE_RESULTS (records stats). Loop so a SPEAKER_VOTE step
    // in between doesn't break this helper.
    let r = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && r++ < 5) store.advancePhase(code);
  }

  function startedStatsRoom(store: RoomStore, players = 3, dilemmaCount = 3): string {
    const { code } = store.create();
    for (let i = 0; i < players; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, dilemmaCount);
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
    // sock-0 is the first key in vote1, i.e. the first to cast VOTE_1 this round.
    expect(stats.get('sock-0')).toEqual({ rounds: 1, changedCount: 0, majorityCount: 1, minorityCount: 0, persuasion: 1, defendedCount: 1, firstToVoteCount: 1 });
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
    // With fair rotation: sock-0 and sock-1 have defended (count=1), while sock-2
    // hasn't (count=0). So round 2 picks sock-2 for A (lowest count).
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'A' });
    const stats = store.get(code)!.stats;
    // Round 2's PREDICT phase is left with nobody having predicted (playRound
    // never calls predict/swingBet), so the soft-timeout auto-default (task 0.1)
    // backfills everyone to the leading side ("A") + "regge" on exit — which
    // happens to match round 2's actual outcome, crediting correctPredictions
    // and correctSwingBets for all three players. Round 1's defaults (to "B",
    // the round-1 leading side at PREDICT time) don't match its actual outcome
    // (A), so they credit nothing there.
    // sock-0 is the first key in vote1 both rounds -> firstToVoteCount: 2.
    expect(stats.get('sock-0')).toEqual({ rounds: 2, changedCount: 0, majorityCount: 2, minorityCount: 0, persuasion: 1, defendedCount: 1, correctPredictions: 1, correctSwingBets: 1, firstToVoteCount: 2 });
    expect(stats.get('sock-1')).toEqual({ rounds: 2, changedCount: 1, majorityCount: 2, minorityCount: 0, persuasion: 0, defendedCount: 1, correctPredictions: 1, correctSwingBets: 1 });
    expect(stats.get('sock-2')).toEqual({ rounds: 2, changedCount: 0, majorityCount: 1, minorityCount: 1, persuasion: 0, defendedCount: 1, correctPredictions: 1, correctSwingBets: 1 });
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
    g = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && g++ < 5) store.advancePhase(code);
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
    // B led first (2-1), A leads second (2-1) — the lead itself flipped.
    expect(swing?.leadFlipped).toBe(true);
  });

  it('reports leadFlipped: false when a vote switches but the leading side does not change', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    // A leads 3-2 first...
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, 'sock-2', 'A');
    store.vote(code, 'sock-3', 'B');
    store.vote(code, 'sock-4', 'B');
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-3', 'A'); // B -> A: A leads 4-1, still A leading
    g = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && g++ < 5) store.advancePhase(code);
    const swing = store.publicSwing(code);
    expect(swing?.switched).toBe(1);
    expect(swing?.leadFlipped).toBe(false);
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

describe('jolly awards (nessuno a mani vuote)', () => {
  function roomWithFullStats(
    store: RoomStore,
    stats: Record<string, {
      rounds: number; changedCount: number; majorityCount: number; minorityCount: number;
      persuasion: number; firstToVoteCount?: number;
    }>,
  ): string {
    const { code } = store.create();
    for (const id of Object.keys(stats)) store.join(code, id, id.toUpperCase());
    const room = store.get(code)!;
    room.stats = new Map(Object.entries(stats));
    return code;
  }

  it('gives an empty-handed player "Il Fulmine" for voting first the most', () => {
    const store = new RoomStore();
    const code = roomWithFullStats(store, {
      // Both never changed idea, but sock-0 has more rounds so wins Il Roccione
      // outright — sock-1 has nothing else to show except voting first a lot.
      'sock-0': { rounds: 3, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 5 },
      'sock-1': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, firstToVoteCount: 4 },
    });
    const awards = store.computeAwards(code);
    expect(awards.find((a) => a.id === 'roccione')?.winner.id).toBe('sock-0');
    const fulmine = awards.find((a) => a.id === 'fulmine');
    expect(fulmine?.winner).toEqual({ id: 'sock-1', nickname: 'SOCK-1' });
  });

  it('gives an empty-handed player who never changed idea "La Sfinge" (separate from Il Roccione)', () => {
    const store = new RoomStore();
    const code = roomWithFullStats(store, {
      // sock-0 wins Il Roccione (most no-change rounds among eligible players).
      'sock-0': { rounds: 5, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 3 },
      // sock-1 ALSO never changed idea, but has fewer rounds — loses Roccione to
      // sock-0, and has no other stat to win a main award, so gets La Sfinge instead.
      'sock-1': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 },
    });
    const awards = store.computeAwards(code);
    expect(awards.find((a) => a.id === 'roccione')?.winner.id).toBe('sock-0');
    expect(awards.find((a) => a.id === 'sfinge')?.winner).toEqual({ id: 'sock-1', nickname: 'SOCK-1' });
  });

  it('falls back to "Il Partecipante" for a player with no standout stat at all', () => {
    const store = new RoomStore();
    const code = roomWithFullStats(store, {
      'sock-0': { rounds: 5, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 5 }, // persuasore + roccione
      'sock-1': { rounds: 3, changedCount: 2, majorityCount: 0, minorityCount: 0, persuasion: 0 }, // wins banderuola (most changes)
      // Changed idea once (so not eligible for La Sfinge), but fewer changes than
      // sock-1 (so loses Il Banderuola too) — genuinely nothing else to show for it.
      'sock-2': { rounds: 3, changedCount: 1, majorityCount: 0, minorityCount: 0, persuasion: 0 },
    });
    const awards = store.computeAwards(code);
    expect(awards.find((a) => a.id === 'banderuola')?.winner.id).toBe('sock-1');
    expect(awards.find((a) => a.id === 'partecipante')?.winner).toEqual({ id: 'sock-2', nickname: 'SOCK-2' });
  });

  it('does not give any jolly award to a player who never played a round', () => {
    const store = new RoomStore();
    const code = roomWithFullStats(store, {
      'sock-0': { rounds: 3, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 5 },
      'sock-1': { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 },
    });
    const awards = store.computeAwards(code);
    expect(awards.some((a) => a.winner.id === 'sock-1')).toBe(false);
  });

  it('does not double up: a player who already won a main award gets no jolly on top', () => {
    const store = new RoomStore();
    const code = roomWithFullStats(store, {
      'sock-0': { rounds: 3, changedCount: 1, majorityCount: 0, minorityCount: 0, persuasion: 5, firstToVoteCount: 9 },
    });
    const awards = store.computeAwards(code);
    const sock0AwardIds = awards.filter((a) => a.winner.id === 'sock-0').map((a) => a.id);
    expect(sock0AwardIds).toContain('persuasore');
    expect(sock0AwardIds).not.toContain('fulmine'); // already won a main award — no jolly on top
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

  it('rejects adding a bot when full or mid-round (not at a round boundary)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (let i = 0; i < MAX_PLAYERS; i++) store.join(code, `s${i}`, `H${i}`);
    expect(store.addBot(code)).toEqual({ ok: false, error: 'ROOM_FULL' });

    const store2 = new RoomStore();
    const c2 = lobbyWith(store2, 3, 0);
    store2.startGame(c2, 3); // PHASE_INTRO — not a round boundary
    expect(store2.addBot(c2)).toEqual({ ok: false, error: 'NOT_ROUND_BOUNDARY' });
  });

  it('allows adding a bot mid-game at a round boundary (PHASE_RESULTS) to reintegrate a drop-out (3.5)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const c = lobbyWith(store, 3, 0);
    store.startGame(c, 3);
    let g = 0;
    while (store.get(c)!.phase !== 'PHASE_RESULTS' && g++ < 10) {
      store.advancePhase(c);
      if (store.get(c)!.phase === 'VOTE_1' || store.get(c)!.phase === 'VOTE_2') {
        for (let i = 0; i < 3; i++) store.vote(c, `sock-${i}`, 'A');
      }
    }
    expect(store.get(c)!.phase).toBe('PHASE_RESULTS');
    const res = store.addBot(c);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.player.isBot).toBe(true);
      expect(res.player.role).toBeUndefined(); // a full giocatore, not Pubblico
    }
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
    store.advancePhase(code); // PREDICT
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
    store.advancePhase(code); // PREDICT
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
    // Classic precomputes the ordered plan from the chosen register's deck, so the
    // plan contains exactly the (single) vita dilemma available.
    if (res.ok) expect(res.room.plannedDilemmas.map((d) => d.id)).toEqual(['x1']);
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

  it('blindSpotFor returns a tip at FINAL_AWARDS and null otherwise', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    addPlayers(store, code, 3); // p0, p1, p2
    store.startGame(code, 3);
    expect(store.blindSpotFor(code, 'p0')).toBeNull(); // before the end
    let guard = 0;
    while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 200) {
      const phase = store.get(code)!.phase;
      if (phase === 'VOTE_1' || phase === 'VOTE_2') {
        ['p0', 'p1', 'p2'].forEach((id) => store.vote(code, id, 'A'));
      }
      store.advancePhase(code);
    }
    expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
    expect(store.blindSpotFor(code, 'p0')?.id).toBeTruthy();
    expect(store.blindSpotFor(code, 'nobody')).toBeNull();
  });
});

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

describe("DEFENSE budget: serataLunga option (3.3)", () => {
  it('defaults to the 90s cap when serataLunga is not requested', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)!.defenseMaxMs).toBe(DEFENSE_MAX_MS_NORMALE);
  });

  it('uses the 180s cap when the leader opts into serataLunga', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, true);
    expect(store.get(code)!.defenseMaxMs).toBe(DEFENSE_MAX_MS_LUNGA);
  });

  it("a human speaker's turn is armed with the room's chosen cap, not a fixed constant", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, true); // serataLunga
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    store.advancePhase(code); // DEFENSE
    const room = store.get(code)!;
    expect(room.phase).toBe('DEFENSE');
    expect(room.phaseExpiresAt).toBe(room.turnStartedAt! + DEFENSE_MAX_MS_LUNGA);
  });
});

describe('late-join promotion (3.2)', () => {
  it('a mid-game joiner is always Pubblico this round, even under the giocatori cap', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`); // well under MAX_GIOCATORI
    store.startGame(code, 3);
    const room = store.get(code)!;
    expect(room.phase).not.toBe('LOBBY');
    const res = store.join(code, 'late1', 'Late1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.player.role).toBe('pubblico');
    expect(room.lateJoiners.has('late1')).toBe(true);
  });

  it("a late-joiner's absence never blocks the CURRENT round's allVoted gate", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.join(code, 'late1', 'Late1'); // joins mid-VOTE_1, before anyone has voted
    for (let i = 0; i < 3; i++) store.vote(code, `sock-${i}`, 'A');
    expect(store.allVoted(code)).toBe(true); // late1 never voted, but doesn't block
  });

  it('promotes a late-joiner to giocatore at the next round boundary (under the cap)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.join(code, 'late1', 'Late1');
    const room = store.get(code)!;
    expect(room.players.get('late1')!.role).toBe('pubblico');
    // Walk to the next round's DILEMMA_REVEAL.
    g = 0;
    const startIndex = room.dilemmaIndex;
    while (room.dilemmaIndex === startIndex && g++ < 30) {
      store.advancePhase(code);
      if (room.phase === 'VOTE_1' || room.phase === 'VOTE_2') {
        for (const id of ['sock-0', 'sock-1', 'sock-2']) store.vote(code, id, 'A');
      }
    }
    expect(room.dilemmaIndex).toBeGreaterThan(startIndex);
    expect(room.players.get('late1')!.role).toBeUndefined(); // promoted
    expect(room.lateJoiners.size).toBe(0);
  });

  it('does not promote past MAX_GIOCATORI — stays Pubblico', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < MAX_GIOCATORI; i++) store.join(code, `sock-${i}`, `P${i}`); // already at the cap
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.join(code, 'late1', 'Late1');
    const room = store.get(code)!;
    for (const id of [...room.players.keys()].filter((id) => id !== 'late1')) store.vote(code, id, 'A');
    g = 0;
    const startIndex = room.dilemmaIndex;
    while (room.dilemmaIndex === startIndex && g++ < 30) store.advancePhase(code);
    expect(room.players.get('late1')!.role).toBe('pubblico'); // cap already full, stays Pubblico
  });

  it('never promotes a late-joiner in duello mode (guard)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.startGame(code, 3, 'misto', 'duello');
    let g = 0;
    while (store.get(code)!.phase !== 'DUEL_PICK' && g++ < 10) store.advancePhase(code);
    store.join(code, 'late1', 'Late1');
    const room = store.get(code)!;
    expect(room.players.get('late1')!.role).toBe('pubblico');
    store.vote(code, 'p1', 'A');
    store.vote(code, 'p2', 'A'); // agree -> straight to DUEL_RESULT
    g = 0;
    while (room.dilemmaIndex === 1 && g++ < 10) store.advancePhase(code);
    expect(room.players.get('late1')!.role).toBe('pubblico'); // never promoted in duello
  });
});

describe('startGame — mood + delicate-theme opt-in (2.2)', () => {
  function mixedFixture(id: string, complessita: Complessita, delicato = false): Dilemma {
    return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', complessita, delicato, spuntiA: [], spuntiB: [] };
  }
  const MIXED: Dilemma[] = [
    mixedFixture('s1', 'sorbetto'),
    mixedFixture('a1', 'alto'),
    mixedFixture('m1', 'max'),
    mixedFixture('p1', 'power'),
    mixedFixture('pd1', 'power', true),
  ];
  const mixedDeck = (_r: ContentRegister) => new Deck(MIXED, () => 0);

  it('rejects an invalid mood', () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    const result = store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'boh');
    expect(result).toEqual({ ok: false, error: 'INVALID_MOOD' });
  });

  it("'mista' (default) excludes only the delicate power dilemma", () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 5); // only 4 cards eligible (pd1 excluded) -> draws all 4, stops there
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['a1', 'm1', 'p1', 's1']);
  });

  it("'leggera' excludes every 'power' dilemma, delicate or not", () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'leggera');
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['a1', 'm1', 's1']);
  });

  it("'profonda' excludes the sorbetto warm-up tier", () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'profonda');
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['a1', 'm1', 'p1']);
  });

  it('delicatoOptIn makes the delicate power dilemma eligible again', () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', true);
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['a1', 'm1', 'p1', 'pd1', 's1']);
  });
});

describe('namedMoments — "I momenti della serata" recap (5.5)', () => {
  const FIXTURE: Dilemma[] = Array.from({ length: 3 }, (_, i) => ({
    id: `d${i + 1}`,
    text: `Dilemma ${i + 1}?`,
    optionA: `A${i + 1}`,
    optionB: `B${i + 1}`,
    register: 'vita' as const,
    spuntiA: [],
    spuntiB: [],
  }));
  const fixtureDeck = (_r: ContentRegister) => new Deck(FIXTURE, () => 0);

  it('accumulates moments across the game and surfaces them only at FINAL_AWARDS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, fixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.publicNamedMoments(code)).toBeNull(); // not FINAL_AWARDS yet

    // Round 1: everyone votes A both times -> plebiscito.
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 14) store.advancePhase(code);
    for (const id of ['s0', 's1', 's2', 's3']) store.vote(code, id, 'A');
    g = 0;
    while (store.get(code)!.phase !== 'VOTE_2' && g++ < 14) store.advancePhase(code);
    for (const id of ['s0', 's1', 's2', 's3']) store.vote(code, id, 'A');
    g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) store.advancePhase(code);
    expect(store.get(code)!.namedMoments.map((m) => m.kind)).toContain('plebiscito');

    // Rounds 2-3: play out normally (2-2 split both times, no swing).
    for (let round = 0; round < 2; round++) {
      g = 0;
      while (store.get(code)!.phase !== 'VOTE_1' && g++ < 14) store.advancePhase(code);
      store.vote(code, 's0', 'A');
      store.vote(code, 's1', 'A');
      store.vote(code, 's2', 'B');
      store.vote(code, 's3', 'B');
      g = 0;
      while (store.get(code)!.phase !== 'VOTE_2' && g++ < 14) store.advancePhase(code);
      g = 0;
      while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) store.advancePhase(code);
    }
    g = 0;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && g++ < 10) store.advancePhase(code);
    const moments = store.publicNamedMoments(code)!;
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.some((m) => m.kind === 'plebiscito')).toBe(true);
    expect(moments.every((m) => m.dilemmaIndex >= 1 && m.dilemmaIndex <= 3)).toBe(true);
  });

  it('resets on rematch — no moments carry over into the next game', () => {
    const store = new RoomStore(generateRoomCode, () => 0, fixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && g++ < 100) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        for (const id of ['s0', 's1', 's2', 's3']) store.vote(code, id, 'A');
      }
    }
    expect(store.get(code)!.namedMoments.length).toBeGreaterThan(0);
    store.rematch(code);
    expect(store.get(code)!.namedMoments).toEqual([]);
  });
});

describe('DILEMMA_REVEAL — roster-template dilemmas (5.3, "contenuto combinatorio sul roster")', () => {
  const ROSTER_FIXTURE: Dilemma[] = [
    {
      id: 'rt01',
      text: '{nome} eredita 50k: cosa ci fa?',
      optionA: 'Li investe',
      optionB: 'Li mette da parte',
      register: 'vita',
      roster: true,
      spuntiA: [],
      spuntiB: [],
    },
  ];
  const rosterDeck = (_r: ContentRegister) => new Deck(ROSTER_FIXTURE, () => 0);

  it("fills {nome} with a random player's nickname on reveal", () => {
    const store = new RoomStore(generateRoomCode, () => 0, rosterDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Bea');
    store.join(code, 'p3', 'Cid');
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    const revealed = store.get(code)!.currentDilemma!;
    expect(revealed.id).toBe('rt01'); // same id — exclusion/authorship still keys off the template
    expect(revealed.text).toMatch(/^(Marco|Bea|Cid) eredita 50k/);
    expect(revealed.text).not.toContain('{nome}');
  });

  it('never excludes a roster template as "già visto" — it reads differently every time (5.1 x 5.3)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, rosterDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Bea');
    store.join(code, 'p3', 'Cid');
    // The device claims to have already seen rt01 — it must still be drawn.
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', ['rt01']);
    expect(store.get(code)!.plannedDilemmas.map((d) => d.id)).toEqual(['rt01']);
  });
});

describe('startGame — device-remembered dilemmas (5.1, "memoria del già-visto")', () => {
  function mixedFixture(id: string, complessita: Complessita, delicato = false): Dilemma {
    return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', complessita, delicato, spuntiA: [], spuntiB: [] };
  }
  const MIXED: Dilemma[] = [
    mixedFixture('s1', 'sorbetto'),
    mixedFixture('a1', 'alto'),
    mixedFixture('m1', 'max'),
    mixedFixture('p1', 'power'),
  ];
  const mixedDeck = (_r: ContentRegister) => new Deck(MIXED, () => 0);

  it("excludes the leader's device-seen ids from the pool", () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', true, false, 'assente', ['s1', 'a1']);
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['m1', 'p1']);
  });

  it('falls back to the full pool rather than starving the game when device memory excludes everything', () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', true, false, 'assente', ['s1', 'a1', 'm1', 'p1']);
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['a1', 'm1', 'p1', 's1']); // ignored the exhaustive exclusion, used the full pool
  });

  it('merges device memory with the rematch exclusion, not replacing it', () => {
    const store = new RoomStore(generateRoomCode, () => 0, mixedDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    const room = store.get(code)!;
    room.excludeDilemmaIds = new Set(['s1']); // as if this were a rematch
    store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', true, false, 'assente', ['a1']);
    const ids = store.get(code)!.plannedDilemmas.map((d) => d.id).sort();
    expect(ids).toEqual(['m1', 'p1']);
  });
});

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

  it("returns to LOBBY keeping the same roster + leader + code, and excludes this game's dilemmas from the next deck", () => {
    const fixture: Dilemma[] = Array.from({ length: 4 }, (_, i) => ({
      id: `d${i + 1}`,
      text: `Dilemma ${i + 1}?`,
      optionA: `A${i + 1}`,
      optionB: `B${i + 1}`,
      register: 'vita' as const,
    }));
    const smallFixtureDeck = (_r: ContentRegister) => new Deck(fixture, () => 0);
    const store = new RoomStore(generateRoomCode, () => 0, smallFixtureDeck, () => 0);
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

  it("5.2 'mai scartati in silenzio': a submitted dilemma that didn't fit THIS game survives into the next", () => {
    const emptyDeck = (_r: ContentRegister) => new Deck([], () => 0);
    const store = new RoomStore(generateRoomCode, () => 0, emptyDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Cid');
    store.setLeader(code, 'p1');
    // 4 submitted dilemmas, an empty deck, dilemmaCount=3 -> exactly 1 is left over.
    store.submitDilemma(code, 'p1', 'Q1?', 'A', 'B');
    store.submitDilemma(code, 'p1', 'Q2?', 'A', 'B');
    store.submitDilemma(code, 'p2', 'Q3?', 'A', 'B');
    store.submitDilemma(code, 'p2', 'Q4?', 'A', 'B');
    store.startGame(code, 3);
    expect(store.get(code)!.plannedDilemmas.length).toBe(3);

    let guard = 0;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && guard++ < 60) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        for (const id of ['p1', 'p2', 'p3']) store.vote(code, id, 'A');
      }
    }
    const playedIds = new Set(store.get(code)!.plannedDilemmas.map((d) => d.id));
    expect(playedIds.size).toBe(3);

    store.rematch(code);
    // The 1 unplayed submitted dilemma survived — not wiped — and its authorship
    // mapping survived with it (still attributable once it's finally played).
    const room = store.get(code)!;
    expect(room.submittedDilemmas.length).toBe(1);
    const leftoverId = room.submittedDilemmas[0].id;
    expect(playedIds.has(leftoverId)).toBe(false);
    expect(room.dilemmaAuthors.has(leftoverId)).toBe(true);
    for (const id of playedIds) expect(room.dilemmaAuthors.has(id)).toBe(false);

    // It gets played (still with an empty deck) in the very next game, with no
    // need to resubmit anything.
    store.startGame(code, 3);
    expect(store.get(code)!.plannedDilemmas.map((d) => d.id)).toEqual([leftoverId]);
  });
});

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

describe('RoomStore.setPlayerUser', () => {
  it('tags a player with a clerk user id; false for unknown room/player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.setPlayerUser(code, 'p1', 'user_123')).toBe(true);
    expect(store.get(code)?.players.get('p1')?.clerkUserId).toBe('user_123');
    expect(store.setPlayerUser('ZZZZ', 'p1', 'user_123')).toBe(false);
    expect(store.setPlayerUser(code, 'ghost', 'user_123')).toBe(false);
  });
});

describe('RoomStore live reactions (engagement)', () => {
  // Drive a fresh room into DEFENSE with a known split; rng=0 makes defender
  // selection deterministic. sides=['A','B','B'] => defenders A->sock-0, B->sock-1,
  // and turn 0 is the side-A speaker (sock-0).
  function defenseRoom(
    store: RoomStore,
    sides: VoteChoice[] = ['A', 'B', 'B'],
  ): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    store.advancePhase(code); // DEFENSE
    return code;
  }

  it('exposes a fixed allowlist of reaction emojis', () => {
    expect(REACTIONS.length).toBeGreaterThan(0);
    expect(REACTIONS).toContain('👏');
  });

  it('records a reaction for the current speaker and returns the emoji', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.get(code)?.phase).toBe('DEFENSE');
    const result = store.react(code, 'sock-1', '👏');
    expect(result).toEqual({ ok: true, emoji: '👏' });
    // The current speaker is sock-0 (side A); the reaction accrues to them.
    expect(store.get(code)?.stats.get('sock-0')?.reactionsReceived).toBe(1);
  });

  it('accumulates reactions from several players onto the current speaker', () => {
    let now = 0;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    store.react(code, 'sock-1', '👏');
    now += REACTION_MIN_INTERVAL_MS; // past the rate-limit window
    store.react(code, 'sock-2', '🔥');
    expect(store.get(code)?.stats.get('sock-0')?.reactionsReceived).toBe(2);
  });

  it('rejects a reaction outside DEFENSE / DUEL_ARGUE', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    expect(store.react(code, 'sock-0', '👏')).toEqual({ ok: false, error: 'NOT_REACTING_PHASE' });
  });

  it('rejects an emoji outside the allowlist', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store);
    expect(store.react(code, 'sock-1', '💩')).toEqual({ ok: false, error: 'INVALID_EMOJI' });
  });

  it('rejects a reaction from someone not in the room, and an unknown room', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = defenseRoom(store);
    expect(store.react(code, 'intruder', '👏')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(store.react('ZZZZ', 'sock-1', '👏')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rate-limits repeated reactions from the same player', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.react(code, 'sock-1', '👏').ok).toBe(true);
    now += REACTION_MIN_INTERVAL_MS - 1; // still within the window
    expect(store.react(code, 'sock-1', '🔥')).toEqual({ ok: false, error: 'RATE_LIMITED' });
    now += 2; // now past the window
    expect(store.react(code, 'sock-1', '🤯').ok).toBe(true);
    // Only the two accepted reactions counted toward the speaker.
    expect(store.get(code)?.stats.get('sock-0')?.reactionsReceived).toBe(2);
  });

  it('tallies reactions per emoji for the CURRENT turn and snapshots them when the turn ends', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // sock-0 defends A, sock-1 defends B (2 defenders)
    const room = store.get(code)!;
    expect(room.lastTurnApplause).toBeNull(); // nothing yet, turn just started

    store.react(code, 'sock-1', '👏'); // sock-1 is NOT speaking yet — reacts to sock-0
    now += REACTION_MIN_INTERVAL_MS;
    store.react(code, 'sock-2', '👏');
    now += REACTION_MIN_INTERVAL_MS;
    store.react(code, 'sock-2', '🔥');
    expect(room.turnReactionTally).toEqual({ '👏': 2, '🔥': 1 });

    // Force-advance to the next defender's turn — the snapshot should capture
    // the FIRST defender's tally, and the live tally resets for the second.
    now += REACTION_MIN_INTERVAL_MS;
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
    store.advancePhase(code);
    expect(store.get(code)!.lastTurnApplause).toBeNull();
  });

  it('allows reactions during a duel argue turn', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.startGame(code, 3, 'misto', 'duello'); // PHASE_INTRO
    store.advancePhase(code); // DUEL_PICK
    store.vote(code, 'p1', 'A');
    store.vote(code, 'p2', 'B'); // disagree -> the duel goes to DUEL_ARGUE
    store.advancePhase(code); // DUEL_REVEAL
    store.advancePhase(code); // DUEL_ARGUE
    expect(store.get(code)?.phase).toBe('DUEL_ARGUE');
    expect(store.react(code, 'p2', '👏').ok).toBe(true);
  });

  it('crowns "Beniamino del pubblico" for the most-reacted player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (const id of ['sock-0', 'sock-1', 'sock-2']) store.join(code, id, id.toUpperCase());
    store.get(code)!.stats = new Map(
      Object.entries({
        'sock-0': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, reactionsReceived: 5 },
        'sock-1': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, reactionsReceived: 2 },
        'sock-2': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 },
      }),
    );
    const beniamino = store.computeAwards(code).find((a) => a.id === 'beniamino');
    expect(beniamino?.winner).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });
  });

  it('omits the beniamino award when nobody received a reaction', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    store.get(code)!.stats = new Map(
      Object.entries({
        'sock-0': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 },
      }),
    );
    expect(store.computeAwards(code).map((a) => a.id)).not.toContain('beniamino');
  });
});

describe('RoomStore predictions (engagement)', () => {
  // Drive a fresh room into the PREDICT phase (after SPLIT_REVEAL, before DEFENSE)
  // with a known first-vote split. rng=0 keeps everything deterministic.
  function predictRoom(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    return code;
  }

  it('reaches a PREDICT phase between SPLIT_REVEAL and DEFENSE', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store);
    expect(store.get(code)?.phase).toBe('PREDICT');
    store.advancePhase(code); // PREDICT -> DEFENSE
    expect(store.get(code)?.phase).toBe('DEFENSE');
  });

  it('records and counts a secret prediction during PREDICT', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store);
    expect(store.predict(code, 'sock-0', 'A').ok).toBe(true);
    expect(store.predictedCount(code)).toBe(1);
    // changing it keeps a single prediction
    expect(store.predict(code, 'sock-0', 'B').ok).toBe(true);
    expect(store.predictedCount(code)).toBe(1);
  });

  it('rejects predicting outside PREDICT, unknown room, intruder, bad choice', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store);
    expect(store.predict('ZZZZ', 'sock-0', 'A')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(store.predict(code, 'intruder', 'A')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(store.predict(code, 'sock-0', 'C')).toEqual({ ok: false, error: 'INVALID_CHOICE' });
    store.advancePhase(code); // DEFENSE
    expect(store.predict(code, 'sock-0', 'A')).toEqual({ ok: false, error: 'NOT_PREDICT_PHASE' });
  });

  it('allPredicted ignores bots and waits only on connected humans', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.join(code, 'sock-1', 'H1');
    store.addBot(code); // a bot never predicts
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'PREDICT' && g++ < 10) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('PREDICT');
    store.predict(code, 'sock-0', 'A');
    expect(store.allPredicted(code)).toBe(false);
    store.predict(code, 'sock-1', 'B');
    expect(store.allPredicted(code)).toBe(true); // bot is not awaited
  });

  it('credits a correct prediction (matched the second-vote majority) at PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store, ['A', 'B', 'B']); // first split A=1 B=2
    store.predict(code, 'sock-0', 'A'); // will be RIGHT (A becomes majority)
    store.predict(code, 'sock-1', 'B'); // will be WRONG
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-1', 'A'); // B->A: second A=2 B=1, majority A
    g = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && g++ < 5) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
    expect(store.get(code)?.stats.get('sock-0')?.correctPredictions).toBe(1);
    expect(store.get(code)?.stats.get('sock-1')?.correctPredictions ?? 0).toBe(0);
  });

  it('credits nobody on a tied second vote', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store, ['A', 'A', 'B', 'B']); // 2-2 tie, nobody changes
    store.predict(code, 'sock-0', 'A');
    store.predict(code, 'sock-1', 'B');
    let g = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && g++ < 12) store.advancePhase(code);
    expect(store.get(code)?.stats.get('sock-0')?.correctPredictions ?? 0).toBe(0);
    expect(store.get(code)?.stats.get('sock-1')?.correctPredictions ?? 0).toBe(0);
  });

  it('reports each predictor’s result at PHASE_RESULTS', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store, ['A', 'B', 'B']);
    store.predict(code, 'sock-0', 'A');
    store.predict(code, 'sock-1', 'B');
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-1', 'A'); // majority becomes A
    g = 0;
    while (store.get(code)?.phase !== 'PHASE_RESULTS' && g++ < 5) store.advancePhase(code);
    const results = store.predictionResults(code);
    expect(results).toContainEqual({ playerId: 'sock-0', predicted: 'A', actual: 'A', correct: true });
    expect(results).toContainEqual({ playerId: 'sock-1', predicted: 'B', actual: 'A', correct: false });
  });

  it('clears predictions for the next dilemma and prunes a leaver', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = predictRoom(store, ['A', 'B', 'B']);
    store.predict(code, 'sock-0', 'A');
    store.predict(code, 'sock-1', 'B');
    expect(store.predictedCount(code)).toBe(2);
    store.leave(code, 'sock-1'); // prune on leave
    expect(store.predictedCount(code)).toBe(1);
    let g = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && g++ < 20) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.predictedCount(code)).toBe(0); // cleared for the new dilemma
  });

  it('crowns "L\'Oracolo" for the most correct predictions; omits it when none', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (const id of ['sock-0', 'sock-1']) store.join(code, id, id.toUpperCase());
    store.get(code)!.stats = new Map(
      Object.entries({
        'sock-0': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, correctPredictions: 3 },
        'sock-1': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, correctPredictions: 1 },
      }),
    );
    const oracolo = store.computeAwards(code).find((a) => a.id === 'oracolo');
    expect(oracolo?.winner).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });

    const store2 = new RoomStore();
    const { code: c2 } = store2.create();
    store2.join(c2, 'sock-0', 'P0');
    store2.get(c2)!.stats = new Map(
      Object.entries({ 'sock-0': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 } }),
    );
    expect(store2.computeAwards(c2).map((a) => a.id)).not.toContain('oracolo');
  });
});

describe('RoomStore best-speaker vote (engagement)', () => {
  // Drive a fresh room into SPEAKER_VOTE (after VOTE_2, before PHASE_RESULTS) with
  // the given first-vote split. rng=0 makes defender selection deterministic:
  // ['A','B','B'] -> defenders A:sock-0, B:sock-1 (2 candidates).
  function speakerVoteRoom(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    store.advancePhase(code); // DEFENSE
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.advancePhase(code); // VOTE_2 -> SPEAKER_VOTE
    return code;
  }

  it('reaches SPEAKER_VOTE between VOTE_2 and PHASE_RESULTS with >=2 defenders', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'B', 'B']);
    expect(store.get(code)?.phase).toBe('SPEAKER_VOTE');
    store.advancePhase(code); // -> PHASE_RESULTS
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
  });

  it('skips SPEAKER_VOTE straight to PHASE_RESULTS with fewer than 2 defenders', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'A', 'A']); // unanimous -> 1 defender
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
  });

  it('exposes the candidate defenders only during SPEAKER_VOTE', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'B', 'B']);
    expect(store.speakerCandidates(code)).toEqual([
      { id: 'sock-0', nickname: 'P0', side: 'A' },
      { id: 'sock-1', nickname: 'P1', side: 'B' },
    ]);
    store.advancePhase(code); // PHASE_RESULTS
    expect(store.speakerCandidates(code)).toBeNull();
  });

  it('records a peer vote and counts it; rejects bad targets and self-votes', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'B', 'B']);
    expect(store.voteSpeaker(code, 'sock-2', 'sock-0').ok).toBe(true); // sock-2 -> defender sock-0
    expect(store.speakerVotedCount(code)).toBe(1);
    expect(store.voteSpeaker(code, 'sock-0', 'sock-0')).toEqual({ ok: false, error: 'INVALID_TARGET' }); // self
    expect(store.voteSpeaker(code, 'sock-2', 'sock-2')).toEqual({ ok: false, error: 'INVALID_TARGET' }); // not a defender
    expect(store.voteSpeaker(code, 'intruder', 'sock-0')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(store.voteSpeaker('ZZZZ', 'sock-2', 'sock-0')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rejects a speaker vote outside SPEAKER_VOTE', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'B', 'B']);
    store.advancePhase(code); // PHASE_RESULTS
    expect(store.voteSpeaker(code, 'sock-2', 'sock-0')).toEqual({ ok: false, error: 'NOT_SPEAKER_VOTE_PHASE' });
  });

  it('allSpeakerVoted ignores bots and waits only on connected humans', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.join(code, 'sock-1', 'H1');
    store.join(code, 'sock-2', 'H2');
    store.addBot(code);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    let g = 0;
    while (store.get(code)?.phase !== 'SPEAKER_VOTE' && g++ < 12) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('SPEAKER_VOTE');
    const [a, b] = store.speakerCandidates(code)!;
    store.voteSpeaker(code, 'sock-0', b.id);
    store.voteSpeaker(code, 'sock-1', a.id);
    expect(store.allSpeakerVoted(code)).toBe(false);
    store.voteSpeaker(code, 'sock-2', a.id);
    expect(store.allSpeakerVoted(code)).toBe(true); // bot is not awaited
  });

  it('accumulates oratorVotes per defender at PHASE_RESULTS, clears + prunes', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = speakerVoteRoom(store, ['A', 'B', 'B']);
    store.voteSpeaker(code, 'sock-1', 'sock-0'); // -> sock-0
    store.voteSpeaker(code, 'sock-2', 'sock-0'); // -> sock-0
    store.advancePhase(code); // PHASE_RESULTS (folds orator votes)
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
    expect(store.get(code)?.stats.get('sock-0')?.oratorVotes).toBe(2);
    // votes cleared + pruned for the next round
    store.leave(code, 'sock-2');
    let g = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && g++ < 20) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.speakerVotedCount(code)).toBe(0);
  });

  it('crowns "Il Grande Oratore" for the most peer votes; omits it when none', () => {
    const store = new RoomStore();
    const { code } = store.create();
    for (const id of ['sock-0', 'sock-1']) store.join(code, id, id.toUpperCase());
    store.get(code)!.stats = new Map(
      Object.entries({
        'sock-0': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, oratorVotes: 4 },
        'sock-1': { rounds: 2, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, oratorVotes: 1 },
      }),
    );
    const oratore = store.computeAwards(code).find((a) => a.id === 'oratore');
    expect(oratore?.winner).toEqual({ id: 'sock-0', nickname: 'SOCK-0' });

    const store2 = new RoomStore();
    const { code: c2 } = store2.create();
    store2.join(c2, 'sock-0', 'P0');
    store2.get(c2)!.stats = new Map(
      Object.entries({ 'sock-0': { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 } }),
    );
    expect(store2.computeAwards(c2).map((a) => a.id)).not.toContain('oratore');
  });
});

describe('RoomStore.delete (lifecycle)', () => {
  it('removes a room from memory and reports it; false for unknown codes', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.has(code)).toBe(true);
    expect(store.size).toBe(1);

    expect(store.delete(code)).toBe(true);
    expect(store.has(code)).toBe(false);
    expect(store.get(code)).toBeUndefined();
    expect(store.size).toBe(0);

    expect(store.delete('ZZZZ')).toBe(false);
  });
});

describe('RoomStore.connectedHumanCount (lifecycle)', () => {
  it('counts connected humans only, ignoring bots and disconnected players', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'h1', 'Ann');
    store.join(code, 'h2', 'Bob');
    store.addBot(code, 'roccione'); // bots never count
    expect(store.connectedHumanCount(code)).toBe(2);

    store.setConnected(code, 'h2', false); // mid-grace -> not connected
    expect(store.connectedHumanCount(code)).toBe(1);

    store.setConnected(code, 'h1', false);
    expect(store.connectedHumanCount(code)).toBe(0); // bot remains, but no humans

    expect(store.connectedHumanCount('ZZZZ')).toBe(0); // unknown room
  });
});

describe('RoomStore.abandonedRooms (lifecycle)', () => {
  it('lists rooms with no connected humans older than maxIdleMs; keeps the rest', () => {
    let t = 0;
    const store = new RoomStore(generateRoomCode, () => t);

    const alive = store.create().code; // createdAt = 0
    store.join(alive, 'h1', 'Ann'); // a connected human -> never abandoned

    const dead = store.create().code; // createdAt = 0
    store.join(dead, 'h2', 'Bob');
    store.setConnected(dead, 'h2', false); // no connected humans

    const fresh = store.create().code; // createdAt = 0, never joined

    t = 60_000; // 60s later
    const reaped = store.abandonedRooms(30_000);
    expect(reaped).toContain(dead); // empty + older than 30s
    expect(reaped).not.toContain(alive); // has a connected human
    expect(reaped).toContain(fresh); // empty + older than 30s
  });

  it('does not list an empty room younger than maxIdleMs', () => {
    let t = 0;
    const store = new RoomStore(generateRoomCode, () => t);
    const code = store.create().code;
    t = 10_000; // only 10s old
    expect(store.abandonedRooms(30_000)).not.toContain(code);
  });
});

describe('RoomStore.restore (snapshot)', () => {
  it('reinserts a room so get/has/size see it', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const room = store.get(code)!;
    store.delete(code);
    expect(store.has(code)).toBe(false);

    store.restore(room);
    expect(store.has(code)).toBe(true);
    expect(store.get(code)).toBe(room);
    expect(store.size).toBe(1);
  });
});

describe('RoomStore.activeCodes (snapshot)', () => {
  it('lists every live room code', () => {
    const store = new RoomStore();
    const a = store.create().code;
    const b = store.create().code;
    expect(store.activeCodes().sort()).toEqual([a, b].sort());
    store.delete(a);
    expect(store.activeCodes()).toEqual([b]);
  });
});

describe('RoomStore VOTE_2 confirm (auto-paced)', () => {
  function toVote2(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 12) store.advancePhase(code);
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 12) store.advancePhase(code);
    return code;
  }

  it('starts VOTE_2 with nobody confirmed even though votes are pre-filled', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.get(code)?.phase).toBe('VOTE_2');
    expect(store.voteCount(code)).toBe(3); // pre-filled defaults present
    expect(store.confirmedCount(code)).toBe(0); // but nobody confirmed yet
    expect(store.allConfirmed(code)).toBe(false);
  });

  it('confirmVote marks a player confirmed; allConfirmed when all present did', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.confirmVote(code, 'sock-0').ok).toBe(true);
    expect(store.confirmVote(code, 'sock-1').ok).toBe(true);
    expect(store.allConfirmed(code)).toBe(false);
    store.confirmVote(code, 'sock-2');
    expect(store.allConfirmed(code)).toBe(true);
    expect(store.confirmedCount(code)).toBe(3);
  });

  it('changing the vote in VOTE_2 also counts as a confirmation', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.vote(code, 'sock-0', 'B'); // change -> confirms
    expect(store.confirmedCount(code)).toBe(1);
  });

  it('rejects confirmVote outside VOTE_2, unknown room, and intruders', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.confirmVote('ZZZZ', 'sock-0')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(store.confirmVote(code, 'ghost')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    store.advancePhase(code); // leave VOTE_2
    expect(store.confirmVote(code, 'sock-0')).toEqual({ ok: false, error: 'NOT_VOTE2_PHASE' });
  });

  it('a leaving player does not block all-confirmed', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.confirmVote(code, 'sock-0');
    store.confirmVote(code, 'sock-1');
    expect(store.allConfirmed(code)).toBe(false);
    store.leave(code, 'sock-2'); // the only unconfirmed present player leaves
    expect(store.allConfirmed(code)).toBe(true);
  });

  it('bots are auto-confirmed on entry to VOTE_2', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.addBot(code);
    store.addBot(code);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 12) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 12) store.advancePhase(code);
    // 2 bots already confirmed; only the human is pending.
    expect(store.confirmedCount(code)).toBe(2);
    store.confirmVote(code, 'sock-0');
    expect(store.allConfirmed(code)).toBe(true);
  });

  it('clears confirmations for the next dilemma', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.confirmVote(code, 'sock-0');
    let g = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && g++ < 30) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.confirmedCount(code)).toBe(0);
  });
});

describe('RoomStore defense — equa rotazione difensori', () => {
  it('dà priorità a chi non ha ancora difeso un lato rispetto a chi lo ha già fatto', () => {
    // dilemmaCount=5 -> il round Avvocato del Diavolo è sempre il penultimo (round
    // 4, 6.2), così i round 1-2 restano normali (nessun ribaltamento di lato), e
    // a parità il tiebreak pesca l'ultimo candidato (come fa già il test US-010).
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.999);
    const code = defenseRoom(store, ['A', 'B', 'B'], 5); // round 1
    expect(store.get(code)?.defenders.find((d) => d.side === 'B')?.id).toBe('sock-2');

    nextDefense(store, code, ['A', 'B', 'B']); // round 2 (normale)
    // sock-2 ha già difeso B (count 1); sock-1 non ha mai parlato (count 0):
    // tocca a sock-1, anche se l'rng da solo ripescherebbe sock-2.
    expect(store.get(code)?.defenders.find((d) => d.side === 'B')?.id).toBe('sock-1');
  });

  it("continua a scegliere l'unico votante di un lato a ogni round", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.999);
    const code = defenseRoom(store, ['A', 'B', 'B'], 5); // solo sock-0 vota A, round 1-2 normali
    expect(store.get(code)?.defenders.find((d) => d.side === 'A')?.id).toBe('sock-0');
    nextDefense(store, code, ['A', 'B', 'B']);
    expect(store.get(code)?.defenders.find((d) => d.side === 'A')?.id).toBe('sock-0');
  });

  it('conta anche il turno nel round Avvocato del Diavolo', () => {
    // rng=()=>0 -> devilRoundIndex=2. Round 1 senza voti (nessun difensore),
    // round 2 (devil) con voti: chi è scelto a difendere DEVE incrementare il
    // contatore anche se argomenta il lato opposto.
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.dilemmaIndex !== 2 && g++ < 50) store.advancePhase(code);
    store.advancePhase(code); // VOTE_1 (round 2 = devil)
    (['A', 'B', 'B'] as VoteChoice[]).forEach((side, i) => store.vote(code, `sock-${i}`, side));
    while (store.get(code)?.phase !== 'DEFENSE' && g++ < 50) store.advancePhase(code);
    const counts = store.get(code)!.defenseCounts;
    // A-voter (sock-0) e il primo B-voter (sock-1) sono stati scelti: count 1 ciascuno.
    expect(counts.get('sock-0')).toBe(1);
    expect(counts.get('sock-1')).toBe(1);
  });

  it('parte da conteggi vuoti quando inizia la partita', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    expect(store.get(code)!.defenseCounts.size).toBe(0); // alla creazione
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)!.defenseCounts.size).toBe(0); // appena avviata, prima di ogni DEFENSE
  });
});

describe('INTERVENTI phase constants + room fields', () => {
  it('exposes the floor/cap/bot durations', () => {
    expect([DEFENSE_MIN_MS, INTERVENTO_MIN_MS, DEFENSE_MAX_MS_NORMALE, DEFENSE_MAX_MS_LUNGA, INTERVENTI_MAX_MS, TURN_BOT_MS])
      .toEqual([30_000, 15_000, 90_000, 180_000, 90_000, 20_000]);
  });
  it("DEFENSE's static fallback matches the default (normale) cap — armTurn overrides with room.defenseMaxMs on entry", () => {
    expect(PHASE_DURATIONS_MS.DEFENSE).toBe(90_000);
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

describe('armTurn on DEFENSE entry', () => {
  it('a human defender gets the 30s floor and the 90s default cap (3.3)', () => {
    const now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    const room = store.get(code)!;
    expect(room.phase).toBe('DEFENSE');
    expect(room.turnMinEndsAt).toBe(now + 30_000);
    expect(room.phaseExpiresAt).toBe(now + DEFENSE_MAX_MS_NORMALE);
  });

  it('records the turn start (turnStartedAt) and exposes it as defense.startedAt', () => {
    const now = 7_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.get(code)!.turnStartedAt).toBe(now);
    expect(store.publicDefense(code)!.startedAt).toBe(now);
  });
});

describe('raiseHand', () => {
  function room4(store: RoomStore) {
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
    expect(store.raiseHand(code, others[0])).toMatchObject({ ok: true, raised: false });
    expect(store.get(code)!.raisedHands).toEqual([others[1]]);
  });
  it('rejects the current speaker and the wrong phase', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = room4(store);
    const speaker = store.get(code)!.defenders[0].id;
    expect(store.raiseHand(code, speaker)).toEqual({ ok: false, error: 'IS_SPEAKER' });
    while (store.get(code)!.phase === 'DEFENSE' || store.get(code)!.phase === 'INTERVENTI') store.advancePhase(code);
    expect(store.raiseHand(code, speaker)).toEqual({ ok: false, error: 'NOT_RAISE_PHASE' });
  });

  it('rejects a Pubblico member raising their hand (never intervenes) (3.1)', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = room4(store);
    const room = store.get(code)!;
    room.players.set('pub1', { id: 'pub1', nickname: 'Pub1', role: 'pubblico' });
    expect(store.raiseHand(code, 'pub1')).toEqual({ ok: false, error: 'PUBBLICO_NEVER_DEFENDS' });
    expect(room.raisedHands).not.toContain('pub1');
  });
});

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

describe('finishTurn', () => {
  it('is rejected before the minimum, accepted after, and only from the speaker', () => {
    let now = 1_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    const speaker = store.get(code)!.defenders[0].id;
    const other = [...store.get(code)!.players.keys()].find((id) => id !== speaker)!;
    expect(store.finishTurn(code, other)).toEqual({ ok: false, error: 'NOT_SPEAKER' });
    expect(store.finishTurn(code, speaker)).toEqual({ ok: false, error: 'TOO_EARLY' });
    now = 1_000 + 30_000;
    expect(store.finishTurn(code, speaker)).toMatchObject({ ok: true });
  });
});

describe('advancePhase weaving DEFENSE/INTERVENTI', () => {
  it('a defender with raised hands enters INTERVENTI, walks the queue, then resumes', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']); // one defender (side A)
    const defender = store.get(code)!.defenders[0].id;
    const others = [...store.get(code)!.players.keys()].filter((id) => id !== defender);
    store.raiseHand(code, others[0]);
    store.raiseHand(code, others[1]);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    expect(store.get(code)!.interventiQueue).toEqual([others[0], others[1]]);
    expect(store.get(code)!.interventiIndex).toBe(0);
    expect(store.get(code)!.raisedHands).toEqual([]);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    expect(store.get(code)!.interventiIndex).toBe(1);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });

  it('a defender with NO raised hands skips INTERVENTI', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'A', 'A']);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });

  it('runs interventi per-defender (two sides)', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']); // two defenders (A then B)
    const d0 = store.get(code)!.defenders[0].id;
    const other = [...store.get(code)!.players.keys()].find((id) => id !== d0)!;
    store.raiseHand(code, other);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('INTERVENTI');
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('DEFENSE');
    expect(store.get(code)!.defenseTurnIndex).toBe(1);
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
  });
});

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
    expect(store.get(code)!.stats.get(others[0])?.reactionsReceived).toBe(1);
  });
});

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
    expect(d1.queue).toBeNull();
    expect(d1.speakerId).toBe(defender);

    store.advancePhase(code); // → INTERVENTI
    const d2 = store.publicDefense(code)!;
    expect(d2.kind).toBe('intervento');
    expect(d2.queue?.map((q) => q.id)).toEqual([others[0], others[1]]);
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
