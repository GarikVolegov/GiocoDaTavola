import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { selectDefenders } from '../defenseSetup';

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
});
