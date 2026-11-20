import { describe, it, expect } from 'vitest';
import {
  GHIGLIOTTINA_PUZZLES,
  normalizeWord,
  drawGhigliottinaPuzzle,
  initGhigliottinaRound,
  submitGhigliottinaGuess,
  resolveGhigliottinaScores,
  serializeGhigliottinaState,
} from '../ghigliottina';
import {
  STIMA_QUESTIONS,
  drawStimaQuestion,
  initStimaRound,
  submitStimaGuess,
  computeStimaPrecisionPct,
  resolveStimaResults,
  serializeStimaState,
} from '../stima';
import {
  BUFALA_QUESTIONS,
  drawBufalaQuestion,
  initBufalaRound,
  submitBufalaVote,
  resolveBufalaResults,
  serializeBufalaState,
} from '../bufala';
import {
  INTESA_CARDS,
  drawIntesaCard,
  pickIntesaSpeaker,
  initIntesaRound,
  resolveIntesaOutcome,
  serializeIntesaState,
} from '../intesa';
import { RoomStore, generateRoomCode } from '../rooms';

describe('TV Game-Show Modes (server datasets, zero pre-reveal leaks & RoomStore)', () => {
  it('validates dataset integrity across Ghigliottina, Stima, Bufala, and Intesa', () => {
    expect(GHIGLIOTTINA_PUZZLES.length).toBeGreaterThanOrEqual(20);
    const ghIds = new Set<string>();
    for (const p of GHIGLIOTTINA_PUZZLES) {
      expect(ghIds.has(p.id)).toBe(false);
      ghIds.add(p.id);
      expect(p.clues).toHaveLength(5);
      expect(p.connections).toHaveLength(5);
      expect(p.choices).toHaveLength(4);
      expect(new Set(p.choices.map(normalizeWord)).size).toBe(4);
      expect(p.choices.map(normalizeWord)).toContain(normalizeWord(p.answer));
    }

    expect(STIMA_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    const stIds = new Set<string>();
    for (const q of STIMA_QUESTIONS) {
      expect(stIds.has(q.id)).toBe(false);
      stIds.add(q.id);
      expect(q.step).toBeGreaterThan(0);
      expect(q.min).toBeLessThan(q.answer);
      expect(q.answer).toBeLessThan(q.max);
      expect(q.unit.trim().length).toBeGreaterThan(0);
      expect(q.funFact.trim().length).toBeGreaterThan(0);
    }

    expect(BUFALA_QUESTIONS.length).toBeGreaterThanOrEqual(24);
    const bfIds = new Set<string>();
    let trueCount = 0;
    let falseCount = 0;
    for (const q of BUFALA_QUESTIONS) {
      expect(bfIds.has(q.id)).toBe(false);
      bfIds.add(q.id);
      expect(q.statement.trim().length).toBeGreaterThan(10);
      expect(q.explanation.trim().length).toBeGreaterThan(10);
      if (q.isTrue) trueCount++;
      else falseCount++;
    }
    expect(trueCount).toBeGreaterThanOrEqual(10);
    expect(falseCount).toBeGreaterThanOrEqual(10);

    expect(INTESA_CARDS.length).toBeGreaterThanOrEqual(24);
    const inIds = new Set<string>();
    for (const c of INTESA_CARDS) {
      expect(inIds.has(c.id)).toBe(false);
      inIds.add(c.id);
      expect(c.forbidden).toHaveLength(4);
      const normWord = normalizeWord(c.word);
      const normForbidden = c.forbidden.map(normalizeWord);
      expect(new Set(normForbidden).size).toBe(4);
      expect(normForbidden).not.toContain(normWord);
    }
  });

  it('never leaks secrets before reveal across all 4 serializers', () => {
    const players = [
      { id: 'p1', nickname: 'Alice' },
      { id: 'p2', nickname: 'Bob' },
    ];
    const nameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? 'Ospite';

    const gh = initGhigliottinaRound(drawGhigliottinaPuzzle(new Set(), () => 0), () => 0);
    submitGhigliottinaGuess(gh, 'p1', gh.puzzle.answer, false);
    const ghPublicHidden = serializeGhigliottinaState(gh, players, nameOf, false);
    expect(ghPublicHidden.answer).toBeUndefined();
    expect(ghPublicHidden.connections).toBeUndefined();
    expect(ghPublicHidden.results).toBeUndefined();
    expect(ghPublicHidden.missingNicknames).toEqual(['Bob']);
    const ghPublicShown = serializeGhigliottinaState(gh, players, nameOf, true);
    expect(ghPublicShown.answer).toBe(gh.puzzle.answer);
    expect(ghPublicShown.connections).toEqual([...gh.puzzle.connections]);
    expect(ghPublicShown.results?.[0].pointsAwarded).toBe(150);

    const st = initStimaRound(drawStimaQuestion(new Set(), () => 0));
    submitStimaGuess(st, 'p1', st.question.answer);
    const stHidden = serializeStimaState(st, players, nameOf, false);
    expect(stHidden.answer).toBeUndefined();
    expect(stHidden.funFact).toBeUndefined();
    expect(stHidden.results).toBeUndefined();
    const stShown = serializeStimaState(st, players, nameOf, true);
    expect(stShown.answer).toBe(st.question.answer);
    expect(stShown.funFact).toBe(st.question.funFact);
    expect(stShown.results?.[0].pointsAwarded).toBe(170);

    const bf = initBufalaRound(drawBufalaQuestion(new Set(), () => 0));
    submitBufalaVote(bf, 'p1', bf.question.isTrue);
    const bfHidden = serializeBufalaState(bf, players, nameOf, false);
    expect(bfHidden.isTrue).toBeUndefined();
    expect(bfHidden.explanation).toBeUndefined();
    expect(bfHidden.results).toBeUndefined();
    const bfShown = serializeBufalaState(bf, players, nameOf, true);
    expect(bfShown.isTrue).toBe(bf.question.isTrue);
    expect(bfShown.explanation).toBe(bf.question.explanation);
    expect(bfShown.results?.[0].pointsAwarded).toBe(100);

    const inc = initIntesaRound(drawIntesaCard(new Set(), () => 0), 'p1');
    const inHidden = serializeIntesaState(inc, nameOf, false);
    expect(inHidden.word).toBeUndefined();
    expect(inHidden.forbidden).toBeUndefined();
    const inShown = serializeIntesaState(inc, nameOf, true);
    expect(inShown.word).toBe(inc.card.word);
    expect(inShown.forbidden).toEqual([...inc.card.forbidden]);
  });

  it('scores Ghigliottina normalization/tiers, Stima precision/closest, Bufala votes, and Intesa resolution cleanly', () => {
    // Ghigliottina accent & case normalization + 150 vs 100
    const puzzle = GHIGLIOTTINA_PUZZLES[0];
    const ghState = initGhigliottinaRound(puzzle, () => 0.1);
    submitGhigliottinaGuess(ghState, 'free', ` ${puzzle.answer.toLowerCase()} `, false);
    submitGhigliottinaGuess(ghState, 'pick', puzzle.answer, true);
    submitGhigliottinaGuess(ghState, 'wrong', 'SBAGLIATA', false);
    const ghScores = resolveGhigliottinaScores(ghState, (id) => id);
    expect(ghScores.find((r) => r.playerId === 'free')?.pointsAwarded).toBe(150);
    expect(ghScores.find((r) => r.playerId === 'pick')?.pointsAwarded).toBe(100);
    expect(ghScores.find((r) => r.playerId === 'wrong')?.pointsAwarded).toBe(0);

    // Stima closest + bull's-eye + computeStimaPrecisionPct
    const q = STIMA_QUESTIONS[1]; // 1992, min 1980, max 2005, step 1
    expect(computeStimaPrecisionPct(q, q.answer)).toBe(100);
    const stState = initStimaRound(q);
    submitStimaGuess(stState, 'p1', q.answer);
    submitStimaGuess(stState, 'p2', q.min);
    const stResults = resolveStimaResults(stState, (id) => id);
    expect(stResults[0].playerId).toBe('p1');
    expect(stResults[0].isWinner).toBe(true);
    expect(stResults[0].isExact).toBe(true);
    expect(stResults[0].pointsAwarded).toBe(170);
    expect(stResults[1].pointsAwarded).toBe(0);

    // Bufala results
    const bfQ = BUFALA_QUESTIONS[0];
    const bfState = initBufalaRound(bfQ);
    submitBufalaVote(bfState, 'right', bfQ.isTrue);
    submitBufalaVote(bfState, 'wrong', !bfQ.isTrue);
    const bfResults = resolveBufalaResults(bfState, (id) => id);
    expect(bfResults[0].playerId).toBe('right');
    expect(bfResults[0].pointsAwarded).toBe(100);
    expect(bfResults[1].pointsAwarded).toBe(0);

    // Intesa speaker balancing & resolution
    const appearances = new Map<string, number>([
      ['p1', 1],
      ['p2', 0],
      ['p3', 1],
    ]);
    expect(pickIntesaSpeaker(['p1', 'p2', 'p3'], appearances, () => 0)).toBe('p2');
    const inState = initIntesaRound(INTESA_CARDS[0], 'p2');
    const guessedOut = resolveIntesaOutcome(inState, 'guessed', 'p3');
    expect(guessedOut).toEqual({ speakerPoints: 100, winnerPoints: 100, winnerId: 'p3' });
    const tabooOut = resolveIntesaOutcome(inState, 'taboo', 'p3');
    expect(tabooOut).toEqual({ speakerPoints: 0, winnerPoints: 0, winnerId: null });
  });

  it('runs standalone RoomStore games for all 4 TV modes, gates Intesa from solo, enforces privateIntesaSecret, and resets on rematch', () => {
    const store = new RoomStore(generateRoomCode, () => 1_000, undefined, () => 0.1);

    // Intesa requires >= 2 players
    const soloRoom = store.create();
    store.join(soloRoom.code, 's1', 'Solo');
    const soloIntesa = store.startGame(
      soloRoom.code,
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
      [],
      'intesa',
    );
    expect(soloIntesa.ok).toBe(false);

    // Solo can play Ghigliottina, Stima, Bufala smoothly
    for (const mode of ['ghigliottina', 'stima', 'bufala'] as const) {
      const r = store.create();
      store.join(r.code, 's1', 'Solo');
      const start = store.startGame(
        r.code,
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
        [],
        mode,
      );
      expect(start.ok).toBe(true);
      store.advancePhase(r.code);
      const room = store.get(r.code)!;
      if (mode === 'ghigliottina') {
        expect(room.phase).toBe('GHIGLIOTTINA');
        expect(store.publicGhigliottinaState(r.code)?.answer).toBeUndefined();
        store.submitGhigliottina(r.code, 's1', room.ghigliottinaState!.puzzle.answer, false);
      } else if (mode === 'stima') {
        expect(room.phase).toBe('STIMA_GUESS');
        expect(store.publicStimaState(r.code)?.answer).toBeUndefined();
        store.submitStima(r.code, 's1', room.stimaState!.question.answer);
      } else {
        expect(room.phase).toBe('BUFALA_VOTE');
        expect(store.publicBufalaState(r.code)?.isTrue).toBeUndefined();
        store.submitBufala(r.code, 's1', room.bufalaState!.question.isTrue);
      }
      store.advancePhase(r.code);
      expect(room.phase).toMatch(/_REVEAL$/);
      expect(room.partyScores.get('s1') ?? 0).toBeGreaterThan(0);
      let guard = 0;
      while (room.phase !== 'FINAL_AWARDS' && guard < 20) {
        store.advancePhase(r.code);
        guard++;
      }
      expect(room.phase).toBe('FINAL_AWARDS');
      expect(store.rematch(r.code).ok).toBe(true);
      expect(room.ghigliottinaState).toBeNull();
      expect(room.stimaState).toBeNull();
      expect(room.bufalaState).toBeNull();
    }

    // Group Intesa: only speaker receives privateIntesaSecret; reveal clears secret gate and rematch cleans state
    const g = store.create();
    store.join(g.code, 'p1', 'Alice');
    store.join(g.code, 'p2', 'Bob');
    const gStart = store.startGame(
      g.code,
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
      [],
      'intesa',
    );
    expect(gStart.ok).toBe(true);
    store.advancePhase(g.code);
    const gRoom = store.get(g.code)!;
    expect(gRoom.phase).toBe('INTESA_PLAY');
    const speakerId = gRoom.intesaState!.speakerId;
    const guesserId = speakerId === 'p1' ? 'p2' : 'p1';
    expect(store.privateIntesaSecret(g.code, speakerId)?.word).toBe(gRoom.intesaState!.card.word);
    expect(store.privateIntesaSecret(g.code, guesserId)).toBeNull();
    expect(store.publicIntesaState(g.code)?.word).toBeUndefined();

    const resIntesa = store.resolveIntesa(g.code, speakerId, 'guessed', guesserId);
    expect(resIntesa.ok).toBe(true);
    expect(gRoom.partyScores.get(speakerId)).toBe(100);
    expect(gRoom.partyScores.get(guesserId)).toBe(100);
    store.advancePhase(g.code);
    expect(gRoom.phase).toBe('INTESA_REVEAL');
    expect(store.publicIntesaState(g.code)?.word).toBe(gRoom.intesaState!.card.word);

    let gGuard = 0;
    while (gRoom.phase !== 'FINAL_AWARDS' && gGuard < 20) {
      store.advancePhase(g.code);
      gGuard++;
    }
    expect(gRoom.phase).toBe('FINAL_AWARDS');
    expect(store.rematch(g.code).ok).toBe(true);
    expect(gRoom.intesaState).toBeNull();
  });
});
