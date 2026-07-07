import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { armTurn, selectDefenders } from '../defenseSetup';
import { TURN_BOT_MS } from '../phases';

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
    expect(defenders.find((d) => d.id === 'b1')!.side).toBe('B');
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
});

describe('defenseSetup.armTurn', () => {
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
});
