import { describe, it, expect } from 'vitest';
import { RoomStore } from '../game/rooms';
import { computeAwards } from '../game/awards';
import { computePodium } from '../game/podium';
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

function drivePartyRoom(store: RoomStore, partyMode: 'flash' | 'infiltrato' | 'coppie' | 'mix'): string {
  const { code } = store.create();
  store.join(code, 'p1', 'Ann');
  store.join(code, 'p2', 'Bob');
  store.join(code, 'p3', 'Cy');
  if (partyMode === 'coppie') {
    store.join(code, 'p4', 'Dan');
  }
  store.setPlayerUser(code, 'p1', 'user_ann');
  store.setPlayerUser(code, 'p2', 'user_bob');
  store.startGame(
    code,
    3,
    'misto',
    'gruppo',
    false,
    false,
    undefined,
    undefined,
    'mista',
    false,
    false,
    'assente',
    [],
    partyMode,
  );
  let guard = 0;
  while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 200) {
    const room = store.get(code)!;
    if (room.phase === 'VOTE_1' || room.phase === 'VOTE_2') {
      // Ann & Bob side with A (majority), Cy sides with B (minority)
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'A');
      store.vote(code, 'p3', partyMode === 'coppie' ? 'A' : 'B');
      if (room.players.has('p4')) store.vote(code, 'p4', 'A');
    } else if (room.phase === 'ACCUSE' && room.infiltratorId) {
      for (const p of room.players.values()) {
        if (p.id !== room.infiltratorId) {
          store.accuse(code, p.id, room.infiltratorId);
        }
      }
    } else if (room.phase === 'HOT_TAKE_VOTE') {
      store.submitHotTake(code, 'p1', 6);
      store.submitHotTake(code, 'p2', 6);
      store.submitHotTake(code, 'p3', 1);
    } else if (room.phase === 'GROUP_MIND') {
      store.groupMindSubmit(code, 'p1', 'A', 'A');
      store.groupMindSubmit(code, 'p2', 'A', 'A');
      store.groupMindSubmit(code, 'p3', 'B', 'B');
    } else if (room.phase === 'WRITE') {
      store.submitWrite(code, 'p1', 'Risposta Ann');
      store.submitWrite(code, 'p2', 'Risposta Bob');
      store.submitWrite(code, 'p3', 'Risposta Cy');
    } else if (room.phase === 'WRITE_VOTE') {
      const publicAnswers = store.publicWrittenAnswers(code) ?? [];
      const p1Token = store.myWrittenAnswerToken(code, 'p1');
      const otherToken = publicAnswers.find((a) => a.id !== p1Token)?.id;
      if (otherToken) store.writeVote(code, 'p2', otherToken);
      if (p1Token) {
        store.writeVote(code, 'p2', p1Token);
        store.writeVote(code, 'p3', p1Token);
      }
    }
    store.advancePhase(code);
  }
  return code;
}

describe('party mode scoring, stats, podium and persistence', () => {
  it('flash mode updates stats, partyScores, podium, awards and persists with party:flash', () => {
    const store = new RoomStore();
    const code = drivePartyRoom(store, 'flash');
    const room = store.get(code)!;
    expect(room.phase).toBe('FINAL_AWARDS');
    expect((room.partyScores.get('p1') ?? 0)).toBeGreaterThan(0);
    expect((room.partyScores.get('p3') ?? 0)).toBe(0);
    expect(room.stats.get('p1')?.rounds).toBeGreaterThan(0);
    expect(room.stats.get('p1')?.majorityCount).toBeGreaterThan(0);
    expect(room.stats.get('p3')?.minorityCount).toBeGreaterThan(0);

    const podium = computePodium(room);
    expect(podium.length).toBe(3);
    expect(podium[0].points).toBeGreaterThan(podium[2].points);

    const awards = computeAwards(room);
    expect(awards.length).toBeGreaterThan(0);

    const persistedAwards = awardsToPersist(room);
    for (const a of persistedAwards) {
      expect(a.gameMode).toBe('party:flash');
    }
    const persistedGames = gamesToPersist(room);
    expect(persistedGames.length).toBe(2);
    const annGame = persistedGames.find((g) => g.clerkUserId === 'user_ann')!;
    expect(annGame.mode).toBe('party:flash');
    expect(annGame.rounds).toBeGreaterThan(0);
    expect(annGame.persuasion).toBeGreaterThan(0);
  });

  it('infiltrato and coppie accumulate stats, partyScores and persist party modes', () => {
    const store = new RoomStore();
    const infCode = drivePartyRoom(store, 'infiltrato');
    const infRoom = store.get(infCode)!;
    expect(infRoom.phase).toBe('FINAL_AWARDS');
    expect(infRoom.stats.get(infRoom.infiltratorId!)?.defendedCount).toBeGreaterThan(0);
    const infGames = gamesToPersist(infRoom);
    expect(infGames.every((g) => g.mode === 'party:infiltrato')).toBe(true);

    const copCode = drivePartyRoom(store, 'coppie');
    const copRoom = store.get(copCode)!;
    expect(copRoom.phase).toBe('FINAL_AWARDS');
    expect(copRoom.partyScores.get('p1')).toBeGreaterThan(0);
    expect(copRoom.partyScores.get('p3')).toBeGreaterThan(0);
    const copGames = gamesToPersist(copRoom);
    expect(copGames.every((g) => g.mode === 'party:coppie')).toBe(true);
    expect(copGames.every((g) => g.persuasion > 0)).toBe(true);
  });

  it('mix mode & breather rounds accumulate stats and partyScores', () => {
    const store = new RoomStore();
    const code = drivePartyRoom(store, 'mix');
    const room = store.get(code)!;
    expect(room.phase).toBe('FINAL_AWARDS');
    expect((room.stats.get('p1')?.rounds ?? 0)).toBeGreaterThan(0);
    const games = gamesToPersist(room);
    expect(games.some((g) => g.mode === 'party:mix' && g.rounds > 0)).toBe(true);
  });
});
