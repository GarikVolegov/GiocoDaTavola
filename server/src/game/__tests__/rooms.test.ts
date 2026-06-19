import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, MAX_PLAYERS } from '../rooms';

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
