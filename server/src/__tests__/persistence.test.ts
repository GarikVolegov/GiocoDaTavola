import { describe, it, expect } from 'vitest';
import { RoomStore } from '../game/rooms';
import { awardsToPersist } from '../persistence';

// Drive a tiny 1-player game where the single player wins every award, then tag
// them with a clerk id and assert only their awards are returned.
function finishedRoom(store: RoomStore, tagged: boolean): string {
  const { code } = store.create();
  store.join(code, 'p1', 'Ann');
  store.join(code, 'p2', 'Bob');
  store.join(code, 'p3', 'Cy');
  if (tagged) store.setPlayerUser(code, 'p1', 'user_ann');
  store.startGame(code, 3);
  let guard = 0;
  while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 200) {
    const room = store.get(code)!;
    if (room.phase === 'VOTE_1' || room.phase === 'VOTE_2') {
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'A');
      store.vote(code, 'p3', 'A');
    }
    store.advancePhase(code);
  }
  return code;
}

describe('awardsToPersist', () => {
  it('returns rows only for winners that are tagged with a clerk user id', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, true);
    const rows = awardsToPersist(store.get(code)!);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.clerkUserId).toBe('user_ann');
      expect(r.gameCode).toBe(code);
      expect(r.gameMode).toBe('gruppo');
      expect(r.nickname).toBe('Ann');
      expect(typeof r.awardId).toBe('string');
    }
  });

  it('returns [] when no winner is tagged', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, false);
    expect(awardsToPersist(store.get(code)!)).toEqual([]);
  });
});
