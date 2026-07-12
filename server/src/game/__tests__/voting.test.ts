import { describe, it, expect } from 'vitest';
import { RoomStore } from '../rooms';
import { unanimousSide } from '../voting';

describe('unanimousSide', () => {
  it('returns the side everyone picked', () => {
    expect(unanimousSide({ A: 3, B: 0 })).toBe('A');
    expect(unanimousSide({ A: 0, B: 4 })).toBe('B');
  });

  it('returns null on a split vote', () => {
    expect(unanimousSide({ A: 2, B: 1 })).toBeNull();
  });

  it('returns null below the 2-vote floor (a leader skip with 0-1 votes is not unanimity)', () => {
    expect(unanimousSide({ A: 1, B: 0 })).toBeNull();
    expect(unanimousSide({ A: 0, B: 0 })).toBeNull();
  });
});

describe('publicUnanimous', () => {
  it('exposes side and count only during UNANIMOUS_REVEAL', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.votes.set('p1', 'B');
    room.votes.set('p2', 'B');
    room.phase = 'UNANIMOUS_REVEAL';
    expect(store.publicUnanimous(code)).toEqual({ side: 'B', count: 2 });
  });

  it('is null outside UNANIMOUS_REVEAL', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.votes.set('p1', 'B');
    room.votes.set('p2', 'B');
    room.phase = 'VOTE_1';
    expect(store.publicUnanimous(code)).toBeNull();
  });
});

describe('missingVoters', () => {
  it('lists connected players who have not voted yet in VOTE_1', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    store.join(code, 'p3', 'Luca');
    store.get(code)!.phase = 'VOTE_1';
    store.vote(code, 'p3', 'A');
    expect(store.missingVoters(code)!.sort()).toEqual(['Giulia', 'Marco']);
  });

  it('checks confirmedVote2, not votes, during VOTE_2', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.phase = 'VOTE_2';
    room.votes.set('p1', 'A'); // pre-filled from VOTE_1, not yet confirmed
    room.votes.set('p2', 'B');
    room.confirmedVote2.add('p2');
    expect(store.missingVoters(code)).toEqual(['Marco']);
  });

  it('excludes a disconnected player (they are not "missing" — they are absent)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    store.join(code, 'p2', 'Giulia');
    const room = store.get(code)!;
    room.phase = 'VOTE_1';
    room.players.get('p2')!.connected = false;
    expect(store.missingVoters(code)).toEqual(['Marco']);
  });

  it('is null outside a voting phase', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Marco');
    expect(store.missingVoters(code)).toBeNull();
  });
});
