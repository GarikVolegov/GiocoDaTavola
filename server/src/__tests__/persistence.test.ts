import { describe, it, expect } from 'vitest';
import { RoomStore } from '../game/rooms';
import { awardsToPersist, saveAwards, gamesToPersist, saveGameRecords } from '../persistence';
import { dbEnabled } from '../db';

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
      // Split vote: an all-A first vote would skip + replace the dilemma (UNANIMOUS_REVEAL).
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'B');
      store.vote(code, 'p3', 'B');
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

describe('saveAwards (no DATABASE_URL in tests)', () => {
  it('is disabled and resolves without throwing', async () => {
    expect(dbEnabled()).toBe(false);
    await expect(saveAwards([])).resolves.toBeUndefined();
  });
});

describe('gamesToPersist', () => {
  it('returns one record per tagged player with that game\'s stats', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, true);
    const rows = gamesToPersist(store.get(code)!);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.clerkUserId).toBe('user_ann');
    expect(r.gameCode).toBe(code);
    expect(r.mode).toBe('gruppo');
    expect(r.nickname).toBe('Ann');
    expect(r.playerCount).toBe(3);
    expect(r.rounds).toBeGreaterThan(0);
    expect(typeof r.persuasion).toBe('number');
    expect(r.awardsCount).toBeGreaterThan(0); // Ann wins the tie-broken awards
  });

  it('returns [] when no player is tagged', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, false);
    expect(gamesToPersist(store.get(code)!)).toEqual([]);
  });
});

describe('saveGameRecords (no DATABASE_URL in tests)', () => {
  it('is disabled and resolves without throwing', async () => {
    expect(dbEnabled()).toBe(false);
    await expect(saveGameRecords([])).resolves.toBeUndefined();
  });
});

// Drive a full Percorso in 2 to DUO_PORTRAIT: Ann predicts right in Atto I,
// gets a 🤯 in Atto II, and flips in Atto III (Bob earns the persuasione).
function finishedDuoRoom(store: RoomStore, tagged: boolean): string {
  const { code } = store.create();
  store.join(code, 'p1', 'Ann');
  store.join(code, 'p2', 'Bob');
  if (tagged) store.setPlayerUser(code, 'p1', 'user_ann');
  store.startGame(code, 3, 'misto', 'duello');
  let guard = 0;
  while (store.get(code)?.phase !== 'DUO_PORTRAIT' && guard++ < 200) {
    const room = store.get(code)!;
    if (room.phase === 'DUO_PICK_PREDICT') {
      store.duoSync(code, 'p1', 'A', 'B'); // Ann predicts Bob=B: right
      store.duoSync(code, 'p2', 'B', 'B'); // Bob predicts Ann=B: wrong
    }
    if (room.phase === 'DUO_SIDE_PICK' || room.phase === 'DUO_PICK') {
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'B');
    }
    if (room.phase === 'DUO_REPICK') {
      store.vote(code, 'p1', 'B'); // Ann flips -> Bob earns +2 persuasione
      store.confirmVote(code, 'p2');
    }
    if (room.phase === 'DUO_WAVER') {
      store.duoWaver(code, 'p1', 1);
      store.duoWaver(code, 'p2', 2); // Bob's 🤯 pays Ann's arringa
    }
    store.advancePhase(code);
  }
  return code;
}

describe('duello persistence (Percorso in 2)', () => {
  it('awardsToPersist maps the duo titles of tagged players at DUO_PORTRAIT', () => {
    const store = new RoomStore();
    const code = finishedDuoRoom(store, true);
    expect(store.get(code)!.phase).toBe('DUO_PORTRAIT');
    const rows = awardsToPersist(store.get(code)!);
    expect(rows.length).toBe(2); // exactly two titles each; only Ann is tagged
    for (const r of rows) {
      expect(r.clerkUserId).toBe('user_ann');
      expect(r.gameMode).toBe('duello');
      expect(r.gameCode).toBe(code);
      expect(r.awardId).toMatch(/^duo-/);
      expect(r.title.length).toBeGreaterThan(0);
    }
  });

  it('gamesToPersist duello: persuasion = duo points, rounds = dilemmas played', () => {
    const store = new RoomStore();
    const code = finishedDuoRoom(store, true);
    const rows = gamesToPersist(store.get(code)!);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.mode).toBe('duello');
    expect(r.rounds).toBe(store.get(code)!.dilemmaCount);
    expect(r.persuasion).toBeGreaterThan(0); // Ann: tiConosco + vacillare
    expect(r.awardsCount).toBe(2);
    expect(r.playerCount).toBe(2);
  });

  it('returns [] for an untagged duello', () => {
    const store = new RoomStore();
    const code = finishedDuoRoom(store, false);
    expect(awardsToPersist(store.get(code)!)).toEqual([]);
    expect(gamesToPersist(store.get(code)!)).toEqual([]);
  });
});
