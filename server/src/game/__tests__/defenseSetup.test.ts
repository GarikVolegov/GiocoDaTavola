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

  it('never selects a Pubblico voter as a defender, even though their vote counts (3.1)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    const room = store.get(code)!;
    room.players.set('pub1', { id: 'pub1', nickname: 'Pub1', role: 'pubblico' });
    room.votes.set('a1', 'A');
    room.votes.set('pub1', 'A'); // Pubblico's vote counts toward the tally...
    const defenders = selectDefenders(room, () => 0);
    expect(defenders).toHaveLength(1);
    expect(defenders[0].id).toBe('a1'); // ...but they're never the one picked to speak
  });

  it('skips a side whose only voters are all Pubblico', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    store.join(code, 'a1', 'A1');
    const room = store.get(code)!;
    room.players.set('pub1', { id: 'pub1', nickname: 'Pub1', role: 'pubblico' });
    room.votes.set('a1', 'A');
    room.votes.set('pub1', 'B'); // only a Pubblico member voted B
    const defenders = selectDefenders(room, () => 0);
    expect(defenders).toHaveLength(1);
    expect(defenders[0].id).toBe('a1');
  });

  it('picks ONE defender per side with fewer than 7 giocatori (unchanged)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 6; i++) store.join(code, `p${i}`, `P${i}`); // 6 giocatori
    const room = store.get(code)!;
    room.votes.set('p0', 'A');
    room.votes.set('p1', 'A');
    room.votes.set('p2', 'B');
    room.votes.set('p3', 'B');
    const defenders = selectDefenders(room, () => 0);
    expect(defenders.filter((d) => d.side === 'A')).toHaveLength(1);
    expect(defenders.filter((d) => d.side === 'B')).toHaveLength(1);
  });

  it('picks up to TWO defenders per side ("a coppie") with 7+ giocatori', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 7; i++) store.join(code, `p${i}`, `P${i}`); // 7 giocatori
    const room = store.get(code)!;
    room.votes.set('p0', 'A');
    room.votes.set('p1', 'A');
    room.votes.set('p2', 'A');
    room.votes.set('p3', 'B');
    room.votes.set('p4', 'B');
    const defenders = selectDefenders(room, () => 0);
    const sideA = defenders.filter((d) => d.side === 'A');
    const sideB = defenders.filter((d) => d.side === 'B');
    expect(sideA).toHaveLength(2);
    expect(sideB).toHaveLength(2);
    expect(new Set(sideA.map((d) => d.id)).size).toBe(2); // two DIFFERENT people, no repeats
  });

  it('a side with only 1 voter still gets just 1 defender, even in "coppie" mode', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 7; i++) store.join(code, `p${i}`, `P${i}`); // 7 giocatori
    const room = store.get(code)!;
    room.votes.set('p0', 'A'); // only one A-voter
    room.votes.set('p1', 'B');
    room.votes.set('p2', 'B');
    const defenders = selectDefenders(room, () => 0);
    expect(defenders.filter((d) => d.side === 'A')).toHaveLength(1);
    expect(defenders.filter((d) => d.side === 'B')).toHaveLength(2);
  });

  it('Pubblico members never count toward the 7-giocatori threshold', () => {
    const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 6; i++) store.join(code, `p${i}`, `P${i}`); // 6 giocatori
    const room = store.get(code)!;
    for (let i = 0; i < 5; i++) room.players.set(`pub${i}`, { id: `pub${i}`, nickname: `Pub${i}`, role: 'pubblico' });
    // 6 giocatori + 5 pubblico = 11 total players, but still only 6 giocatori.
    room.votes.set('p0', 'A');
    room.votes.set('p1', 'A');
    room.votes.set('p2', 'B');
    room.votes.set('p3', 'B');
    const defenders = selectDefenders(room, () => 0);
    expect(defenders.filter((d) => d.side === 'A')).toHaveLength(1); // still 1-per-side
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
