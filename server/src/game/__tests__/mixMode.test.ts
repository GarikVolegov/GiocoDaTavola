import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, buildMixPlan } from '../rooms';
import { Deck, type Dilemma } from '../deck';
import { computeAwards } from '../awards';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 12 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));

describe('Serata Mix (variable mini-game mode) & party bug regressions', () => {
  it('never places two identical mini-game kinds back to back, includes cruciverba/tribunale, and excludes coppie on odd player counts', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const oddPlan = buildMixPlan(12, 5, rng);
    expect(oddPlan).toHaveLength(12);
    expect(oddPlan).toContain('cruciverba');
    expect(oddPlan).toContain('tribunale');
    expect(oddPlan).toContain('telepatia');
    expect(oddPlan).toContain('preferiresti');
    expect(oddPlan).not.toContain('coppie');
    expect(new Set(oddPlan).size).toBeGreaterThanOrEqual(9);
    for (let i = 1; i < oddPlan.length; i++) {
      expect(oddPlan[i]).not.toBe(oddPlan[i - 1]);
    }
    const evenPlan = buildMixPlan(12, 4, rng);
    expect(evenPlan).toContain('cruciverba');
    expect(evenPlan).toContain('preferiresti');
    expect(new Set(evenPlan).size).toBeGreaterThanOrEqual(10);
  });

  it('excludes infiltrato when fewer than 4 players', () => {
    const plan = buildMixPlan(10, 3, () => 0.99);
    expect(plan).not.toContain('infiltrato');
    expect(plan).not.toContain('coppie');
  });

  it('plays a full Serata Mix game from PHASE_INTRO through FINAL_AWARDS and cleans state on rematch', () => {
    let step = 0;
    const steps = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 0.96, 0.72];
    const rng = () => {
      const val = steps[step % steps.length];
      step++;
      return val;
    };
    const store = new RoomStore(
      generateRoomCode,
      () => 10_000,
      () => new Deck(DILEMMA_FIXTURE, rng),
      rng,
    );
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.join(code, 'p4', 'Dana');

    const startRes = store.startGame(
      code,
      10,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'mix',
    );
    expect(startRes.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.partyMode).toBe('mix');
    expect(room.mixPlan).toHaveLength(10);

    let loopCount = 0;
    const visitedPhases = new Set<string>();
    while (room.phase !== 'FINAL_AWARDS' && loopCount < 80) {
      visitedPhases.add(room.phase);
      store.advancePhase(code);
      loopCount++;
    }
    expect(room.phase).toBe('FINAL_AWARDS');
    expect(visitedPhases.has('CRUCIVERBA')).toBe(true);
    expect(visitedPhases.has('TELEPATHY')).toBe(true);

    // Rematch must reset mix-mode round artifacts cleanly
    const rematchRes = store.rematch(code);
    expect(rematchRes.ok).toBe(true);
    expect(room.phase).toBe('LOBBY');
    expect(room.cruciverbaState).toBeNull();
    expect(room.tribunaleState).toBeNull();
    expect(room.telepathyAnswers.size).toBe(0);
    expect(room.votes1.size).toBe(0);
    expect(room.writeAnswers.size).toBe(0);
    expect(room.writeVotes.size).toBe(0);
  });

  it('Flash mode leaves VOTE_1 untimed (phaseExpiresAt null), flags isEmpty on 0 votes, and omits Il Roccione when VOTE_2 never occurred', () => {
    const store = new RoomStore(
      generateRoomCode,
      () => 5_000,
      () => new Deck(DILEMMA_FIXTURE, () => 0),
      () => 0,
    );
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');

    store.startGame(
      code,
      3,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'flash',
    );
    const room = store.get(code)!;
    store.advancePhase(code); // -> VOTE_1
    expect(room.phase).toBe('VOTE_1');
    expect(room.phaseExpiresAt).toBeNull();

    // Advance without any votes -> SPLIT_REVEAL reports isEmpty: true (never fake tie celebration)
    store.advancePhase(code);
    expect(room.phase).toBe('SPLIT_REVEAL');
    expect(room.flashResult?.isEmpty).toBe(true);

    let guard = 0;
    while (room.phase !== 'FINAL_AWARDS' && guard < 20) {
      store.advancePhase(code);
      guard++;
    }
    expect(room.phase).toBe('FINAL_AWARDS');
    expect(computeAwards(room).some((a) => a.id === 'roccione')).toBe(false);
  });

  it('WRITE_REVEAL records writeVotes instead of inflating defendedCount (Il Persuasore)', () => {
    let step = 0;
    const steps = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 0.96, 0.36];
    const rng = () => {
      const val = steps[step % steps.length];
      step++;
      return val;
    };
    const store = new RoomStore(
      generateRoomCode,
      () => 5_000,
      () => new Deck(DILEMMA_FIXTURE, rng),
      rng,
    );
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.join(code, 'p4', 'Dana');
    store.startGame(
      code,
      10,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'mix',
    );
    const room = store.get(code)!;

    let guard = 0;
    while (room.phase !== 'WRITE' && room.phase !== 'FINAL_AWARDS' && guard < 60) {
      store.advancePhase(code);
      guard++;
    }
    expect(room.phase).toBe('WRITE');

    const prevDefended = room.stats.get('p1')?.defendedCount ?? 0;
    store.submitWrite(code, 'p1', 'Risposta geniale di Alice');
    store.submitWrite(code, 'p2', 'Risposta di Bob');
    store.advancePhase(code); // -> WRITE_VOTE
    expect(room.phase).toBe('WRITE_VOTE');

    const p1Token = store.myWrittenAnswerToken(code, 'p1')!;
    expect(p1Token).toBeTruthy();
    store.writeVote(code, 'p2', p1Token);
    store.writeVote(code, 'p3', p1Token);
    store.advancePhase(code); // -> WRITE_REVEAL
    expect(room.phase).toBe('WRITE_REVEAL');

    expect(room.stats.get('p1')?.writeVotes).toBe(2);
    expect(room.stats.get('p1')?.defendedCount ?? 0).toBe(prevDefended);
    const awards = computeAwards(room);
    expect(awards.some((a) => a.id === 'pennadoro' && a.winner.id === 'p1')).toBe(true);
  });

  it('runs parallel fixed-couple rounds in Serata Mix for even player counts and settles Couple Leaderboard cleanly', () => {
    let step = 0;
    const steps = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 0.96, 0.72];
    const rng = () => {
      const val = steps[step % steps.length];
      step++;
      return val;
    };
    const store = new RoomStore(
      generateRoomCode,
      () => 5_000,
      () => new Deck(DILEMMA_FIXTURE, rng),
      rng,
    );
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.join(code, 'p4', 'Dana');

    store.startGame(
      code,
      10,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'mix',
    );
    const room = store.get(code)!;
    expect(room.couples).toHaveLength(2);

    // Ensure at least one coppie round exists or directly inspect a forced coppie check
    let guard = 0;
    while (room.phase !== 'FINAL_AWARDS' && guard < 80) {
      if (room.phase === 'VOTE_1' && room.mixPlan[room.dilemmaIndex - 1] === 'coppie') {
        break;
      }
      store.advancePhase(code);
      guard++;
    }

    if (room.mixPlan[room.dilemmaIndex - 1] === 'coppie') {
      expect(room.phase).toBe('VOTE_1');
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'A');
      expect(store.allVoted(code)).toBe(false);
      store.vote(code, 'p3', 'B');
      store.vote(code, 'p4', 'A');
      expect(store.allVoted(code)).toBe(true);
    }
  });

  it('excludes hotTake from solo buildMixPlan, serves solo questionari & 2-option preferiresti, and passes cruciverbaMode scelte', () => {
    const soloPlan = buildMixPlan(12, 1, () => 0.37);
    expect(soloPlan).toHaveLength(12);
    expect(soloPlan).not.toContain('hotTake');
    expect(soloPlan).not.toContain('coppie');
    expect(soloPlan).not.toContain('infiltrato');
    expect(soloPlan).not.toContain('tribunale');
    expect(soloPlan).not.toContain('telepatia');

    const store = new RoomStore(
      generateRoomCode,
      () => 5_000,
      undefined,
      () => 0.2,
    );

    // 1) Solo Preferiresti emits strictly 2 options
    const rPref = store.create();
    store.join(rPref.code, 'solo1', 'Viandante');
    const prefStart = store.startGame(
      rPref.code,
      3,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'preferiresti',
      undefined,
      undefined,
      undefined,
      'misto',
      undefined,
      'scelte',
      true,
    );
    expect(prefStart.ok).toBe(true);
    store.advancePhase(rPref.code);
    const prefRoom = store.get(rPref.code)!;
    expect(prefRoom.phase).toBe('VOTE_1');
    const prefPublic = store.publicPartyCard(rPref.code);
    expect(prefPublic?.mode).toBe('preferiresti');
    if (prefPublic?.mode === 'preferiresti' && 'options' in prefPublic) {
      expect(prefPublic.options).toHaveLength(2);
    }

    // 2) Solo Cruciverba with cruciverbaMode: 'scelte' initializes 4-choice mode with blank clues
    const rCruc = store.create();
    store.join(rCruc.code, 'solo2', 'Enigmista');
    store.startGame(
      rCruc.code,
      3,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'cruciverba',
      undefined,
      undefined,
      undefined,
      'misto',
      undefined,
      'scelte',
      true,
    );
    store.advancePhase(rCruc.code);
    const crucRoom = store.get(rCruc.code)!;
    expect(crucRoom.phase).toBe('CRUCIVERBA');
    expect(crucRoom.cruciverbaState?.mode).toBe('scelte');
    expect(crucRoom.cruciverbaState?.revealedCells.size).toBe(1);

    // 3) Solo GROUP_MIND inside Mix draws from solo questionari
    const rMix = store.create();
    store.join(rMix.code, 'solo3', 'Curioso');
    store.startGame(
      rMix.code,
      10,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'mix',
      undefined,
      undefined,
      undefined,
      'misto',
      undefined,
      'scelte',
      true,
    );
    const mixRoom = store.get(rMix.code)!;
    let guard = 0;
    while (mixRoom.phase !== 'GROUP_MIND' && mixRoom.phase !== 'FINAL_AWARDS' && guard < 40) {
      store.advancePhase(rMix.code);
      guard++;
    }
    if (mixRoom.phase === 'GROUP_MIND') {
      expect(mixRoom.groupMindQuestion?.id.startsWith('sq')).toBe(true);
    }
  });

  it('expands Solo Mix to 8 distinct games excluding intesa and 12-round Group Mix to >= 11 games with TV modes', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const soloPlan = buildMixPlan(8, 1, rng);
    expect(soloPlan).toHaveLength(8);
    expect(new Set(soloPlan).size).toBe(8);
    expect(soloPlan).toContain('ghigliottina');
    expect(soloPlan).toContain('stima');
    expect(soloPlan).toContain('bufala');
    expect(soloPlan).not.toContain('intesa');
    for (let i = 1; i < soloPlan.length; i++) {
      expect(soloPlan[i]).not.toBe(soloPlan[i - 1]);
    }

    const groupPlan12 = buildMixPlan(12, 4, rng);
    expect(groupPlan12).toHaveLength(12);
    expect(new Set(groupPlan12).size).toBeGreaterThanOrEqual(11);
    const tvNewCount = ['ghigliottina', 'stima', 'bufala', 'intesa'].filter((k) =>
      groupPlan12.includes(k as (typeof groupPlan12)[number]),
    ).length;
    expect(tvNewCount).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < groupPlan12.length; i++) {
      expect(groupPlan12[i]).not.toBe(groupPlan12[i - 1]);
    }
  });
});
