import { describe, it, expect } from 'vitest';
import {
  RoomStore,
  generateRoomCode,
  nextPhase,
  PHASE_DURATIONS_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  DILEMMA_COUNT_OPTIONS,
  type GamePhase,
} from '../rooms';

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
    const result = store.startGame(code, 4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.room.phase).toBe('PHASE_INTRO');
      expect(result.room.dilemmaCount).toBe(4);
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

  it('rejects a dilemma count outside 3/4/5', () => {
    const store = new RoomStore();
    const code = roomWith(store, 3);
    expect(store.startGame(code, 2)).toEqual({ ok: false, error: 'INVALID_DILEMMA_COUNT' });
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
