import { describe, it, expect } from 'vitest';
import { RoomStore } from '../rooms';
import { loadCuratedDecks } from '../geminiGenerator';

describe('Party Modes ("Schierati" Overhaul)', () => {
  it('curated deck has cards for all 4 party modes with strict party criteria', () => {
    const decks = loadCuratedDecks();
    expect(decks.flash.length).toBeGreaterThanOrEqual(25);
    expect(decks.infiltrato.length).toBeGreaterThanOrEqual(15);
    expect(decks.coppie.complicita.length).toBeGreaterThanOrEqual(10);
    expect(decks.coppie.piccante.length).toBeGreaterThanOrEqual(10);
    expect(decks.assurdo.length).toBeGreaterThanOrEqual(15);

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

  it('starts SCHIERATI FLASH with 15s blitz defense and curated cards', () => {
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
    expect(result.room.defenseMaxMs).toBe(15_000); // 15s blitz defense
    expect(result.room.partyCards.length).toBe(5);

    // Advance to DILEMMA_REVEAL
    store.advancePhase(code);
    expect(result.room.phase).toBe('DILEMMA_REVEAL');
    expect(result.room.currentPartyCard).not.toBeNull();
    expect(result.room.currentDilemma).not.toBeNull();
    expect(result.room.currentDilemma?.register).toBe('vita');

    const publicCard = store.publicPartyCard(code);
    expect(publicCard).not.toBeNull();
    expect(publicCard?.mode).toBe('flash');
    expect(publicCard?.penalty).toContain('minoranza');
  });

  it("starts L'INFILTRATO with 60s debate, assigns infiltrator and hides secrets until reveal", () => {
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
    expect(result.room.defenseMaxMs).toBe(60_000); // 60s debate timer

    store.advancePhase(code); // DILEMMA_REVEAL
    const publicCard = store.publicPartyCard(code);
    expect(publicCard?.mode).toBe('infiltrato');
    // Secret question stays hidden from public view during reveal
    expect(publicCard?.groupQuestion).toBeUndefined();
    expect(publicCard?.infiltratorUnmasked).toBe(false);

    // In SPLIT_REVEAL phase (after accusation), questions and infiltrator are unmasked
    store.advancePhase(code); // moves to DEFENSE
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
    expect(result.room.defenseMaxMs).toBe(30_000);

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
    expect(result.room.defenseMaxMs).toBe(30_000);

    store.advancePhase(code); // DILEMMA_REVEAL
    // Force current party card to gogna
    result.room.currentPartyCard = {
      id: 'test-gogna',
      cardType: 'gogna',
      prompt: 'Chi finirebbe prima nei guai?',
    };

    store.advancePhase(code); // VOTE_1
    expect(result.room.phase).toBe('VOTE_1');

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
    store.advancePhase(code); // DILEMMA_REVEAL
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

  it('evaluates Hot-Seat bets in Coppie & Scintille for groups > 2', () => {
    const store = new RoomStore(() => 'TEST', () => 1000);
    const room = store.create();
    const code = room.code;
    const { player: p1 } = store.join(code, 'p1', 'Alice') as { player: Player };
    const { player: p2 } = store.join(code, 'p2', 'Bob') as { player: Player };
    const { player: p3 } = store.join(code, 'p3', 'Charlie') as { player: Player };

    store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'assente', [], 'coppie', 'piccante', 'Addio al celibato');
    expect(store.get(code)?.theme).toBe('Addio al celibato');
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1

    // p1 and p2 are the hot seat couple
    store.vote(code, p1.id, 'A');
    store.vote(code, p2.id, 'A'); // they matched!

    // p3 is spectator and bets 'match'
    store.recordHotSeatBet(code, p3.id, 'match');

    store.advancePhase(code); // SPLIT_REVEAL
    const card = store.publicPartyCard(code);
    expect(card?.hotSeat).toBeDefined();
    expect(card?.hotSeat?.coupleMatched).toBe(true);
    expect(card?.hotSeat?.correctSpectators).toContain('Charlie');
    // Charlie receives +50 points
    expect(store.get(code)?.partyScores.get(p3.id)).toBe(50);
  });
});
