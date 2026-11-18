import { describe, it, expect } from 'vitest';
import {
  CRUCIVERBA_TURN_SEC,
  TRIBUNALE_SPEAK_SEC,
  createInitialPassState,
  passReducer,
  computePassAwards,
  computePassFinaleSummary,
  getCurrentReaderPlayer,
  type PassPlayer,
} from './passAndPlayEngine';
import { FALLBACK_DECKS } from './fallbackDeck';

const PLAYERS_3: PassPlayer[] = [
  { id: 'p1', name: 'Marco', avatar: '🦊' },
  { id: 'p2', name: 'Giulia', avatar: '🐙' },
  { id: 'p3', name: 'Luca', avatar: '🦁' },
];

const PLAYERS_2: PassPlayer[] = [
  { id: 'p1', name: 'Sara', avatar: '🦊' },
  { id: 'p2', name: 'Ale', avatar: '🐙' },
];

describe('passAndPlayEngine', () => {
  it('starts Flash directly in DEBATE (zero pass curtains) and resolves each round in 1 tap', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'flash',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.flash.slice(0, 2),
    });
    expect(s.phase).toBe('DEBATE');
    expect(getCurrentReaderPlayer(s)?.id).toBe('p1');

    // Round 1 resolved with 1 tap -> advances directly to Round 2 DEBATE with rotated reader
    s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'A' });
    expect(s.phase).toBe('DEBATE');
    expect(s.roundIndex).toBe(1);
    expect(getCurrentReaderPlayer(s)?.id).toBe('p2');

    // Round 2 resolved -> FINAL_AWARDS
    s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'SPLIT' });
    expect(s.phase).toBe('FINAL_AWARDS');
    const summary = computePassFinaleSummary(s);
    expect(summary.moments).toHaveLength(2);
    expect(summary.moments[0].liveVerdictLabel).toBe(FALLBACK_DECKS.flash[0].optionA);
    expect(summary.moments[1].momentBadge.label).toBe('Spaccati a metà!');
  });

  it('runs Classico as Arringa & Cambio Idea with live defenders and twist', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'classico',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.flash.slice(0, 2),
      rng: () => 0.1, // triggers devil round (< 0.25)
    });
    expect(s.phase).toBe('DEBATE');
    expect(s.classicoState?.defenderAId).toBe('p1');
    expect(s.classicoState?.defenderBId).toBe('p2');
    expect(s.classicoState?.isDevilRound).toBe(true);

    s = passReducer(s, { type: 'RESOLVE_CLASSICO', outcome: 'FLIP', rng: () => 0.9 });
    expect(s.phase).toBe('DEBATE');
    expect(s.roundIndex).toBe(1);
    expect(s.classicoState?.isDevilRound).toBe(false);

    s = passReducer(s, { type: 'RESOLVE_CLASSICO', outcome: 'CONVINCE_A' });
    expect(s.phase).toBe('FINAL_AWARDS');
    const awards = computePassAwards(s);
    expect(awards.some((a) => a.id === 'voltagabbana')).toBe(true);
  });

  it('runs L’Infiltrato with 1 single secret reading pass and 1-tap live accusation', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'infiltrato',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.infiltrato.slice(0, 1),
      rng: () => 0.5, // index 1 -> 'p2' Giulia
    });
    expect(s.phase).toBe('PASS_CURTAIN');
    expect(s.infiltratoId).toBe('p2');
    expect(s.secretKind).toBe('infiltrato_read');

    for (let i = 0; i < 3; i++) {
      expect(s.phase).toBe('PASS_CURTAIN');
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      expect(s.phase).toBe('SECRET_TURN');
      s = passReducer(s, { type: 'ACK_SECRET' });
    }
    expect(s.phase).toBe('DEBATE');

    // Accuse p2 directly in 1 tap (no second phone-passing loop)
    s = passReducer(s, { type: 'RESOLVE_INFILTRATO_ACCUSATION', accusedId: 'p2' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.infiltratoCaught).toBe(true);
    expect(s.roundOutcome?.infiltratoId).toBe('p2');
    expect(s.stats.p1.infiltratoCatches).toBe(1);
    expect(s.stats.p3.infiltratoCatches).toBe(1);
    expect(s.stats.p2.infiltratoWins).toBe(0);

    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('FINAL_AWARDS');
  });

  it('awards infiltratoWins when live accusation misses the infiltrator', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'infiltrato',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.infiltrato.slice(0, 1),
      rng: () => 0.5, // 'p2'
    });
    for (let i = 0; i < 3; i++) {
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      s = passReducer(s, { type: 'ACK_SECRET' });
    }
    s = passReducer(s, { type: 'RESOLVE_INFILTRATO_ACCUSATION', accusedId: 'p1' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.infiltratoCaught).toBe(false);
    expect(s.stats.p2.infiltratoWins).toBe(1);
  });

  it('runs Assurdo Gogna & Dignita in 1 tap with zero phone passing', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'assurdo',
      players: PLAYERS_3,
      cards: [FALLBACK_DECKS.assurdo[0], FALLBACK_DECKS.assurdo[1]], // gogna, dignita
    });
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_GOGNA', targetId: 'p1' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.gognaWinnerIds).toEqual(['p1']);
    expect(s.stats.p1.gognaHits).toBe(1);

    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_DIGNITA', outcome: 'YES' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.liveVerdictLabel).toBe(FALLBACK_DECKS.assurdo[1].optionA);
  });

  it('allows Coppie with odd players (dynamic pairing) and resolves alignments & challenges in 1 tap', () => {
    let odd = createInitialPassState();
    odd = passReducer(odd, {
      type: 'START_GAME',
      mode: 'coppie',
      players: PLAYERS_3,
      cards: [FALLBACK_DECKS.coppie[0], FALLBACK_DECKS.coppie[1]], // allineamento, verita/obbligo
    });
    expect(odd.phase).toBe('DEBATE');
    expect(odd.coppieState?.featuredPairIds).toEqual(['p1', 'p2']);

    odd = passReducer(odd, { type: 'RESOLVE_COPPIE_ALIGN', matchedCoupleIds: ['dynamic_pair'] });
    expect(odd.phase).toBe('ROUND_RESULT');
    expect(odd.roundOutcome?.coppieMatched).toBe(true);
    expect(odd.stats.p1.coppieMatches).toBe(1);
    expect(odd.stats.p2.coppieMatches).toBe(1);

    odd = passReducer(odd, { type: 'NEXT_ROUND' });
    expect(odd.phase).toBe('DEBATE');
    odd = passReducer(odd, { type: 'RESOLVE_COPPIE_CHALLENGE', completed: true });
    expect(odd.phase).toBe('FINAL_AWARDS');
  });

  it('requires at least 3 players for Infiltrato and Tribunale', () => {
    const inf = passReducer(createInitialPassState(), {
      type: 'START_GAME',
      mode: 'infiltrato',
      players: PLAYERS_2,
      cards: FALLBACK_DECKS.infiltrato,
    });
    expect(inf.phase).toBe('SETUP');

    const trib = passReducer(createInitialPassState(), {
      type: 'START_GAME',
      mode: 'tribunale',
      players: PLAYERS_2,
      cards: FALLBACK_DECKS.tribunale,
    });
    expect(trib.phase).toBe('SETUP');
  });

  it('runs Cruciverba Show vocally (30s, hint letter reveal, 1-tap solve without typing)', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'cruciverba',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.cruciverba.slice(0, 1),
    });
    expect(s.phase).toBe('DEBATE');
    expect(s.debateDurationSec).toBe(CRUCIVERBA_TURN_SEC);
    expect(s.cruciverbaState).not.toBeNull();

    // Hint reveals 1 letter without changing phase or rotating device
    const afterHint = passReducer(s, { type: 'CRUCIVERBA_PASS', reason: 'hint', rng: () => 0 });
    expect(afterHint.phase).toBe('DEBATE');
    expect(afterHint.cruciverbaState?.revealedCells.length).toBeGreaterThanOrEqual(1);

    // Solve all pending words via 1-tap solver selection
    let cur = afterHint;
    const words = cur.cruciverbaState!.board.words;
    for (const w of words) {
      if (cur.phase !== 'DEBATE') break;
      if (cur.cruciverbaState?.wordStatus[w.id] === 'pending') {
        cur = passReducer(cur, { type: 'CRUCIVERBA_SOLVE_WORD', wordId: w.id, solverId: 'p2' });
      }
    }
    expect(cur.phase).toBe('ROUND_RESULT');
    expect(cur.roundOutcome?.kind).toBe('cruciverba');

    const fin = passReducer(cur, { type: 'NEXT_ROUND' });
    expect(fin.phase).toBe('FINAL_AWARDS');
    expect(computePassAwards(fin).some((a) => a.id === 'mentecollettiva' && a.winnerId === 'p2')).toBe(true);
  });

  it('runs Tribunale with 20s speaker turns and 1-tap live jury verdict', () => {
    let trib = createInitialPassState();
    trib = passReducer(trib, {
      type: 'START_GAME',
      mode: 'tribunale',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.tribunale.slice(0, 1),
    });
    expect(trib.phase).toBe('DEBATE');
    expect(trib.debateDurationSec).toBe(TRIBUNALE_SPEAK_SEC);
    expect(trib.tribunaleState?.speakerIndex).toBe(0);
    expect(trib.tribunaleState?.verdictReady).toBe(false);
    // Reader is chosen from jury so Accusa and Difesa speak hands-free
    expect(getCurrentReaderPlayer(trib)?.id).toBe('p3');

    trib = passReducer(trib, { type: 'TRIBUNALE_NEXT_SPEAKER' });
    expect(trib.tribunaleState?.speakerIndex).toBe(1);
    expect(trib.tribunaleState?.verdictReady).toBe(false);

    trib = passReducer(trib, { type: 'TRIBUNALE_NEXT_SPEAKER' });
    expect(trib.phase).toBe('DEBATE');
    expect(trib.tribunaleState?.verdictReady).toBe(true);

    trib = passReducer(trib, { type: 'TRIBUNALE_RESOLVE', winner: 'ACCUSA' });
    expect(trib.phase).toBe('ROUND_RESULT');
    expect(trib.roundOutcome?.tribunaleWinner).toBe('ACCUSA');
    expect(trib.stats.p1.tribunaleWins).toBe(1);
  });

  it('runs Serata Mix across flash, infiltrato, assurdo, and coppie even with odd players', () => {
    const mixCards = [
      FALLBACK_DECKS.mix[0], // flash
      FALLBACK_DECKS.mix[1], // infiltrato
      FALLBACK_DECKS.mix[2], // assurdo gogna
      FALLBACK_DECKS.mix[3], // coppie
    ];
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'mix',
      players: PLAYERS_3,
      cards: mixCards,
      rng: () => 0,
    });
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'UNANIMOUS', rng: () => 0 });

    // Round 2: infiltrato
    expect(s.phase).toBe('PASS_CURTAIN');
    for (let i = 0; i < 3; i++) {
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      s = passReducer(s, { type: 'ACK_SECRET' });
    }
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_INFILTRATO_ACCUSATION', accusedId: s.infiltratoId });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.infiltratoCaught).toBe(true);

    // Round 3: gogna
    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_GOGNA', targetId: 'p3' });
    expect(s.phase).toBe('ROUND_RESULT');

    // Round 4: coppie in odd group
    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('DEBATE');
    s = passReducer(s, { type: 'RESOLVE_COPPIE_ALIGN', matchedCoupleIds: [] });
    expect(s.phase).toBe('ROUND_RESULT');

    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('FINAL_AWARDS');

    const summary = computePassFinaleSummary(s);
    expect(summary.verdict.roundsPlayed).toBe(4);
    expect(summary.playerProfiles).toHaveLength(3);
    expect(summary.mvp).not.toBeNull();
    expect(summary.shareText).toContain('SCHIERATI');
  });

  it('runs Preferiresti che... directly in DEBATE (zero pass curtains) and resolves 4-choice debates', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'preferiresti',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.preferiresti.slice(0, 2),
    });
    expect(s.phase).toBe('DEBATE');
    expect(getCurrentReaderPlayer(s)?.id).toBe('p1');

    s = passReducer(s, { type: 'RESOLVE_PREFERIRESTI', choice: 'C' });
    if (s.phase === 'ROUND_RESULT') {
      s = passReducer(s, { type: 'NEXT_ROUND' });
    }
    expect(s.phase).toBe('DEBATE');
    expect(s.roundIndex).toBe(1);
    expect(getCurrentReaderPlayer(s)?.id).toBe('p2');

    s = passReducer(s, { type: 'RESOLVE_PREFERIRESTI', choice: 'SPLIT' });
    if (s.phase === 'ROUND_RESULT') {
      s = passReducer(s, { type: 'NEXT_ROUND' });
    }
    expect(s.phase).toBe('FINAL_AWARDS');
    const summary = computePassFinaleSummary(s);
    expect(summary.moments).toHaveLength(2);
    expect(summary.moments[0].liveVerdictLabel).toBe(FALLBACK_DECKS.preferiresti[0].options[2]);
    expect(summary.moments[1].liveVerdictLabel).not.toMatch(/strad|opzione/i);
  });

  it('supports solo (1 player) in solo-compatible modes', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'flash',
      players: [PLAYERS_3[0]],
      cards: FALLBACK_DECKS.flash.slice(0, 1),
    });
    expect(s.phase).toBe('DEBATE');
    expect(getCurrentReaderPlayer(s)?.id).toBe('p1');
    s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'A' });
    if (s.phase === 'ROUND_RESULT') {
      s = passReducer(s, { type: 'NEXT_ROUND' });
    }
    expect(s.phase).toBe('FINAL_AWARDS');
  });
});
