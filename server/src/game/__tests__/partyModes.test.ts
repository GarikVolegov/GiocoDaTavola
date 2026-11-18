import { describe, it, expect } from 'vitest';
import { RoomStore, type Player } from '../rooms';
import { loadCuratedDecks } from '../geminiGenerator';

describe('Party Modes ("Schierati" Overhaul)', () => {
  it('curated deck has cards for all 4 party modes with strict party criteria', () => {
    const decks = loadCuratedDecks();
    expect(decks.flash.length).toBeGreaterThanOrEqual(25);
    expect(decks.infiltrato.length).toBeGreaterThanOrEqual(15);
    expect(decks.coppie.complicita.length).toBeGreaterThanOrEqual(10);
    expect(decks.coppie.piccante.length).toBeGreaterThanOrEqual(10);
    expect(decks.assurdo.length).toBeGreaterThanOrEqual(15);
    expect((decks.preferiresti ?? []).length).toBeGreaterThanOrEqual(25);

    for (const card of decks.preferiresti ?? []) {
      expect(card.prompt.length).toBeGreaterThan(0);
      expect(card.options.length).toBe(4);
      expect(card.options.every((opt) => opt.trim().length > 0)).toBe(true);
    }

    // Verify brevity on flash cards (max 15-18 words)
    for (const card of decks.flash) {
      const words = card.text.trim().split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(20);
      expect(card.optionA.length).toBeGreaterThan(0);
      expect(card.optionB.length).toBeGreaterThan(0);
    }

    // Verify infiltrato question pairs
    for (const card of decks.infiltrato) {
      expect(card.groupQuestion.length).toBeGreaterThan(0);
      expect(card.impostorQuestion.length).toBeGreaterThan(0);
      expect(card.groupQuestion).not.toBe(card.impostorQuestion);
    }
  });

  it('starts SCHIERATI FLASH without countdown timer and curated cards', () => {
    const store = new RoomStore(
      () => 'TEST',
      () => 1000,
    );
    const room = store.create();
    const code = room.code;
    store.join(code, 'p1', 'P1');
    store.join(code, 'p2', 'P2');
    store.join(code, 'p3', 'P3');

    const result = store.startGame(
      code,
      5,
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
      'flash',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.room.partyMode).toBe('flash');
    expect(result.room.defenseMaxMs).toBe(90_000);
    expect(result.room.partyCards.length).toBe(5);

    // Advance to VOTE_1 directly (DILEMMA_REVEAL skipped)
    store.advancePhase(code);
    expect(result.room.phase).toBe('VOTE_1');
    expect(result.room.currentPartyCard).not.toBeNull();
    expect(result.room.currentDilemma).not.toBeNull();
    expect(result.room.currentDilemma?.register).toBe('vita');

    const publicCard = store.publicPartyCard(code);
    expect(publicCard).not.toBeNull();
    expect(publicCard?.mode).toBe('flash');
    expect(publicCard?.penalty).toContain('minoranza');
  });

  it("starts L'INFILTRATO without debate timer, assigns infiltrator and hides secrets until reveal", () => {
    const store = new RoomStore(
      () => 'TEST',
      () => 1000,
    );
    const room = store.create();
    const code = room.code;
    store.join(code, 'p1', 'P1');
    store.join(code, 'p2', 'P2');
    store.join(code, 'p3', 'P3');

    const result = store.startGame(
      code,
      5,
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
      'infiltrato',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.room.partyMode).toBe('infiltrato');
    expect(result.room.infiltratorId).toBeDefined();
    expect(result.room.defenseMaxMs).toBe(90_000);

    store.advancePhase(code); // DEFENSE (infiltrato enters directly at DEFENSE)
    const publicCard = store.publicPartyCard(code);
    expect(publicCard?.mode).toBe('infiltrato');
    // Secret question stays hidden from public view during debate
    expect(publicCard?.groupQuestion).toBeUndefined();
    expect(publicCard?.infiltratorUnmasked).toBe(false);

    // In SPLIT_REVEAL phase (after accusation), questions and infiltrator are unmasked
    store.advancePhase(code); // moves to ACCUSE
    const accuseCard = store.publicPartyCard(code);
    expect(accuseCard?.infiltratorUnmasked).toBe(false); // still hidden during accusation!

    store.advancePhase(code); // moves to SPLIT_REVEAL
    const unmaskedCard = store.publicPartyCard(code);
    expect(unmaskedCard?.infiltratorUnmasked).toBe(true);
    expect(unmaskedCard?.groupQuestion).toBeDefined();
    expect(unmaskedCard?.impostorQuestion).toBeDefined();
    expect(unmaskedCard?.infiltratoRoundResult).toBeDefined();
  });

  it('starts COPPIE & SCINTILLE supporting piccante 18+ and complicita', () => {
    const store = new RoomStore(
      () => 'TEST',
      () => 1000,
    );
    const room = store.create();
    const code = room.code;
    store.join(code, 'p1', 'P1');
    store.join(code, 'p2', 'P2');

    const result = store.startGame(
      code,
      5,
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
      'coppie',
      'piccante',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.room.partyMode).toBe('coppie');
    expect(result.room.partyIntensity).toBe('piccante');
    expect(result.room.defenseMaxMs).toBe(90_000);

    store.advancePhase(code); // DILEMMA_REVEAL
    const publicCard = store.publicPartyCard(code);
    expect(publicCard?.mode).toBe('coppie');
    expect(publicCard?.intensity).toBe('piccante');
    expect(publicCard?.prompt).toBeDefined();
  });

  it('starts ASSURDO MA SEMPLICE with La Gogna voting and friend pillory', () => {
    const store = new RoomStore(
      () => 'TEST',
      () => 1000,
    );
    const room = store.create();
    const code = room.code;
    const p1 = (store.join(code, 'p1', 'Alice') as { player: Player }).player;
    const p2 = (store.join(code, 'p2', 'Bob') as { player: Player }).player;
    const p3 = (store.join(code, 'p3', 'Charlie') as { player: Player }).player;

    const result = store.startGame(
      code,
      5,
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
      'assurdo',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.room.partyMode).toBe('assurdo');
    expect(result.room.defenseMaxMs).toBe(90_000);

    store.advancePhase(code); // VOTE_1
    expect(result.room.phase).toBe('VOTE_1');
    // Force current party card to gogna
    result.room.currentPartyCard = {
      id: 'test-gogna',
      cardType: 'gogna',
      prompt: 'Chi finirebbe prima nei guai?',
    };

    // Players cast gogna votes
    store.recordGognaVote(code, p1.id, p2.id); // Alice votes Bob
    store.recordGognaVote(code, p3.id, p2.id); // Charlie votes Bob
    store.recordGognaVote(code, p2.id, p1.id); // Bob votes Alice

    store.advancePhase(code); // SPLIT_REVEAL
    expect(result.room.phase).toBe('SPLIT_REVEAL');
    expect(result.room.gognaTargetId).toBe(p2.id);
    expect(result.room.gognaTargetNickname).toBe('Bob');
    expect(result.room.gognaVotesCount).toBe(2);

    const publicCard = store.publicPartyCard(code);
    expect(publicCard?.gognaTargetNickname).toBe('Bob');
    expect(publicCard?.gognaVotes).toBe(2);
  });

  it('correctly handles Schierati Flash doxxing of minority and unvoted players', () => {
    const store = new RoomStore(() => 'TEST', () => 1000);
    const room = store.create();
    const code = room.code;
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };
    const { player: _p4 } = store.join(code, 'p4', 'Diana') as { player: Player };

    store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'flash');
    store.advancePhase(code); // VOTE_1

    // p1 and p2 vote A, p3 votes B, p4 does not vote (holdout)
    store.vote(code, p1.id, 'A');
    store.vote(code, p2.id, 'A');
    store.vote(code, p3.id, 'B');
    // p4 does not vote

    store.advancePhase(code); // SPLIT_REVEAL
    const publicCard = store.publicPartyCard(code);
    expect(publicCard?.flashResult).toBeDefined();
    expect(publicCard?.flashResult?.isUnanimous).toBe(false);
    expect(publicCard?.flashResult?.isTie).toBe(false);
    expect(publicCard?.flashResult?.minoritySide).toBe('B');
    // Minority includes Charlie (voted B) AND Diana (unvoted holdout!)
    expect(publicCard?.flashResult?.minorityNicknames).toContain('Charlie');
    expect(publicCard?.flashResult?.minorityNicknames).toContain('Diana');
    expect(publicCard?.flashResult?.majorityNicknames).toContain('Alice');
    expect(publicCard?.flashResult?.majorityNicknames).toContain('Bob');
  });

  it('enforces even player count in Coppie & Scintille, runs fixed pairs in parallel, and scores couple matches', () => {
    const store = new RoomStore(() => 'TEST', () => 1000);
    const room = store.create();
    const code = room.code;
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };

    // Odd player count must fail cleanly
    const oddErr = store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'coppie', 'piccante');
    expect(oddErr.ok).toBe(false);
    if (!oddErr.ok) expect(oddErr.error).toBe('EVEN_PLAYERS_REQUIRED');

    const { player: p4 } = store.join(code, 'p4', 'Diana') as { player: Player };

    const startRes = store.startGame(
      code,
      3,
      'vita',
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
      'coppie',
      'piccante',
      'Addio al celibato',
      undefined,
      'misto',
      [
        [p1.id, p3.id],
        [p2.id, p4.id],
      ],
    );
    expect(startRes.ok).toBe(true);
    expect(store.get(code)?.theme).toBe('Addio al celibato');
    expect(store.get(code)?.couples.map((c) => [c.memberAId, c.memberBId])).toEqual([
      [p1.id, p3.id],
      [p2.id, p4.id],
    ]);

    store.advancePhase(code); // VOTE_1
    // Couple 1 (Alice & Charlie) both pick 'A' -> match!
    store.vote(code, p1.id, 'A');
    store.vote(code, p3.id, 'A');
    // Couple 2 (Bob & Diana) split -> mismatch!
    store.vote(code, p2.id, 'A');
    store.vote(code, p4.id, 'B');

    store.advancePhase(code); // SPLIT_REVEAL
    const card = store.publicPartyCard(code);
    expect(card?.couples).toHaveLength(2);
    expect(card?.coupleRoundResults).toHaveLength(2);
    const c1Out = card?.coupleRoundResults?.find((o) => o.memberAId === p1.id);
    expect(['match', 'challenge_done']).toContain(c1Out?.kind);
    expect((store.get(code)?.partyScores.get(p1.id) ?? 0)).toBeGreaterThan(0);
    expect((store.get(code)?.partyScores.get(p3.id) ?? 0)).toBeGreaterThan(0);
  });

  it('skips DEFENSE automatically in Flash mode when everyone votes the same (no empty defense screen)', () => {
    const store = new RoomStore(() => 'TEST', () => 1000);
    const room = store.create();
    const code = room.code;
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };

    store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'flash');
    store.advancePhase(code); // VOTE_1 (round 1)
    store.vote(code, p1.id, 'A');
    store.vote(code, p2.id, 'A');
    store.vote(code, p3.id, 'A');

    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.get(code)?.phase).toBe('SPLIT_REVEAL');

    store.advancePhase(code); // skips DEFENSE -> VOTE_1 (round 2)
    expect(store.get(code)?.phase).toBe('VOTE_1');
    expect(store.get(code)?.dilemmaIndex).toBe(2);
  });

  it('resolves accusations and results properly inside mix mode infiltrato rounds', () => {
    let seed = 0;
    const rng = () => ((seed++ * 0.37) % 1);
    const store = new RoomStore(() => 'TEST', () => 1000, undefined, rng);
    const room = store.create();
    const code = room.code;
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };
    const { player: p4 } = store.join(code, 'p4', 'Diana') as { player: Player };

    store.startGame(code, 7, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'mix');
    const r = store.get(code)!;
    const infIdx = r.mixPlan.indexOf('infiltrato');
    expect(infIdx).toBeGreaterThanOrEqual(0);

    // Advance until we hit the infiltrato round's DEFENSE -> ACCUSE -> SPLIT_REVEAL
    while (r.phase !== 'FINAL_AWARDS') {
      store.advancePhase(code);
      if (r.dilemmaIndex === infIdx + 1 && r.phase === 'DEFENSE') {
        store.advancePhase(code); // -> ACCUSE
        expect(r.phase).toBe('ACCUSE');
        const target = r.infiltratorId!;
        const accusers = [p1.id, p2.id, p3.id, p4.id].filter((id) => id !== target);
        for (const a of accusers) store.accuse(code, a, target);
        store.advancePhase(code); // -> SPLIT_REVEAL
        expect(r.phase).toBe('SPLIT_REVEAL');
        expect(r.infiltratoRoundResult).not.toBeNull();
        expect(r.infiltratoRoundResult?.caught).toBe(true);
        break;
      }
    }
  });

  it('enters Flash DEFENSE with no reading window or countdown timer and allows pause/resume', () => {
    const now = 10_000;
    const store = new RoomStore(() => 'TEST', () => now);
    const { code } = store.create();
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };

    store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'flash');
    store.advancePhase(code); // VOTE_1
    store.vote(code, p1.id, 'A');
    store.vote(code, p2.id, 'A');
    store.vote(code, p3.id, 'B'); // Charlie is in minority

    store.advancePhase(code); // SPLIT_REVEAL
    expect(store.get(code)?.phase).toBe('SPLIT_REVEAL');

    store.advancePhase(code); // DEFENSE (no timer, no reading window)
    const room = store.get(code)!;
    expect(room.phase).toBe('DEFENSE');
    expect(room.readingEndsAt).toBeNull();
    expect(room.phaseExpiresAt).toBeNull();

    // Pause / resume works cleanly without timers
    expect(store.pauseGame(code)).toBe(true);
    expect(room.paused).toBe(true);
    expect(room.readingEndsAt).toBeNull();
    expect(room.pausedReadingRemainingMs).toBeNull();

    expect(store.resumeGame(code)).toBe(true);
    expect(room.paused).toBe(false);
    expect(room.readingEndsAt).toBeNull();
    expect(room.phaseExpiresAt).toBeNull();
  });

  it('enters Tribunale and Cruciverba inside Serata Mix without reading windows or turn timers', () => {
    const now = 5_000;
    let step = 0;
    const steps = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 0.96, 0.72];
    const rng = () => steps[step++ % steps.length];
    const store = new RoomStore(() => 'TEST', () => now, undefined, rng);
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Charlie');
    store.join(code, 'p4', 'Diana');

    store.startGame(code, 10, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'mix');
    const room = store.get(code)!;

    let sawTribunale = false;
    let sawCruciverba = false;
    let guard = 0;
    while (room.phase !== 'FINAL_AWARDS' && guard++ < 80) {
      store.advancePhase(code);
      if (room.phase === 'TRIBUNALE_ARGUE') {
        sawTribunale = true;
        expect(room.readingEndsAt).toBeNull();
        expect(room.turnExpiresAt).toBeNull();
      } else if (room.phase === 'CRUCIVERBA') {
        sawCruciverba = true;
        expect(room.readingEndsAt).toBeNull();
        expect(room.turnExpiresAt).toBeNull();
      }
    }
    expect(sawTribunale).toBe(true);
    expect(sawCruciverba).toBe(true);
  });

  it('runs PREFERIRESTI CHE... with 4 choices, minority identification, and timer-free defense', () => {
    const now = 10_000;
    const store = new RoomStore(() => 'TEST', () => now);
    const { code } = store.create();
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };
    const { player: p4 } = store.join(code, 'p4', 'Diana') as { player: Player };

    const result = store.startGame(
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
      'preferiresti',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.room.partyMode).toBe('preferiresti');
    expect(result.room.defenseMaxMs).toBe(90_000);
    expect(result.room.partyCards.length).toBe(3);

    store.advancePhase(code); // VOTE_1
    expect(result.room.phase).toBe('VOTE_1');

    const voteCard = store.publicPartyCard(code);
    expect(voteCard?.mode).toBe('preferiresti');
    expect(voteCard?.options).toHaveLength(4);

    // Alice & Bob choose C; Charlie chooses A; Diana chooses D -> C is majority, Charlie & Diana are minority
    expect(store.vote(code, p1.id, 'C').ok).toBe(true);
    expect(store.vote(code, p2.id, 'C').ok).toBe(true);
    expect(store.vote(code, p3.id, 'A').ok).toBe(true);
    expect(store.vote(code, p4.id, 'D').ok).toBe(true);
    expect(store.vote(code, p4.id, 'E').ok).toBe(false);

    store.advancePhase(code); // SPLIT_REVEAL
    expect(result.room.phase).toBe('SPLIT_REVEAL');
    const revealCard = store.publicPartyCard(code);
    expect(revealCard?.preferirestiResult?.isUnanimous).toBe(false);
    expect(revealCard?.preferirestiResult?.isTie).toBe(false);
    expect(revealCard?.preferirestiResult?.winningChoices).toEqual(['C']);
    expect(revealCard?.preferirestiResult?.majorityNicknames).toEqual(['Alice', 'Bob']);
    expect(revealCard?.preferirestiResult?.minorityNicknames).toEqual(['Charlie', 'Diana']);

    store.advancePhase(code); // DEFENSE without reading grace or countdown
    expect(result.room.phase).toBe('DEFENSE');
    expect(result.room.readingEndsAt).toBeNull();
    expect(result.room.phaseExpiresAt).toBeNull();

    // Advance -> round 2 VOTE_1
    store.advancePhase(code);
    expect(result.room.phase).toBe('VOTE_1');
    expect(result.room.dilemmaIndex).toBe(2);

    // Unanimous vote on C skips DEFENSE directly to round 3 VOTE_1
    store.vote(code, p1.id, 'C');
    store.vote(code, p2.id, 'C');
    store.vote(code, p3.id, 'C');
    store.vote(code, p4.id, 'C');
    store.advancePhase(code); // SPLIT_REVEAL
    expect(result.room.preferirestiResult?.isUnanimous).toBe(true);
    store.advancePhase(code); // skips DEFENSE -> VOTE_1 round 3
    expect(result.room.phase).toBe('VOTE_1');
    expect(result.room.dilemmaIndex).toBe(3);
  });
});
