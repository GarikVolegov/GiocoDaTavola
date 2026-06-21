import { describe, it, expect } from 'vitest';
import { RoomStore, type Room } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';
import { serializeRoom, deserializeRoom } from '../roomSnapshot';

const FIXTURE: Dilemma[] = Array.from({ length: 4 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `D${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: ['x', 'y'],
  spuntiB: ['x', 'y'],
}));
const makeDeck = (_r: ContentRegister) => new Deck(FIXTURE, () => 0);

// Drive a room into VOTE_1 with two votes so the snapshot carries populated Maps
// and a partially-drawn Deck.
function liveRoom(): Room {
  const store = new RoomStore(undefined, () => 1_000, makeDeck);
  const { code } = store.create();
  store.join(code, 'p0', 'Ann');
  store.join(code, 'p1', 'Bob');
  store.join(code, 'p2', 'Cy');
  store.startGame(code, 3);
  store.advancePhase(code); // DILEMMA_REVEAL (draws d1)
  store.advancePhase(code); // VOTE_1
  store.vote(code, 'p0', 'A');
  store.vote(code, 'p1', 'B');
  return store.get(code)!;
}

describe('roomSnapshot round-trip', () => {
  it('preserves primitives, Maps and the Deck across serialize -> deserialize', () => {
    const room = liveRoom();
    const restored = deserializeRoom(serializeRoom(room));

    // Primitives
    expect(restored.code).toBe(room.code);
    expect(restored.phase).toBe('VOTE_1');
    expect(restored.createdAt).toBe(room.createdAt);

    // Maps come back as real Maps with the same entries
    expect(restored.players).toBeInstanceOf(Map);
    expect([...restored.players.keys()].sort()).toEqual(['p0', 'p1', 'p2']);
    expect(restored.votes).toBeInstanceOf(Map);
    expect(restored.votes.get('p0')).toBe('A');
    expect(restored.votes.get('p1')).toBe('B');

    // Deck comes back as a real Deck with the same remaining cards (the rng is a
    // function and can't be serialized, so a restored deck just uses Math.random —
    // what matters is that the same cards are still drawable).
    expect(restored.deck).toBeInstanceOf(Deck);
    expect(restored.deck!.remainingCount).toBe(room.deck!.remainingCount);
    expect(restored.deck!.cards.map((c) => c.id).sort()).toEqual(
      room.deck!.cards.map((c) => c.id).sort(),
    );
  });

  it('round-trips an empty/lobby room (no deck, empty Maps)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const restored = deserializeRoom(serializeRoom(store.get(code)!));
    expect(restored.phase).toBe('LOBBY');
    expect(restored.deck).toBeNull();
    expect(restored.votes).toBeInstanceOf(Map);
    expect(restored.votes.size).toBe(0);
  });

  it('a restored room is still playable (RoomStore can advance it)', () => {
    const room = liveRoom(); // VOTE_1 with votes + a live Deck
    const json = serializeRoom(room);
    // Restore into a fresh store, as boot does, then drive the state machine on.
    const store = new RoomStore(undefined, () => 2_000, makeDeck);
    store.restore(deserializeRoom(json));
    const res = store.advancePhase(room.code);
    expect(res.ok).toBe(true);
    expect(store.get(room.code)!.phase).toBe('SPLIT_REVEAL');
  });
});
