import { describe, it, expect } from 'vitest';
import {
  createInitialPassState,
  passReducer,
  computePassAwards,
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
  it('runs a full Flash round with secret pass-curtain turns and aggregate split', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'flash',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.flash.slice(0, 2),
    });
    expect(s.phase).toBe('CARD_INTRO');

    s = passReducer(s, { type: 'BEGIN_ROUND' });
    expect(s.phase).toBe('PASS_CURTAIN');
    expect(s.turnIndex).toBe(0);

    // Player 1 votes A
    s = passReducer(s, { type: 'UNLOCK_TURN' });
    expect(s.phase).toBe('SECRET_TURN');
    s = passReducer(s, { type: 'SUBMIT_VOTE', choice: 'A' });
    expect(s.phase).toBe('PASS_CURTAIN');
    expect(s.turnIndex).toBe(1);

    // Player 2 votes B
    s = passReducer(s, { type: 'UNLOCK_TURN' });
    s = passReducer(s, { type: 'SUBMIT_VOTE', choice: 'B' });
    expect(s.phase).toBe('PASS_CURTAIN');
    expect(s.turnIndex).toBe(2);

    // Player 3 votes A
    s = passReducer(s, { type: 'UNLOCK_TURN' });
    s = passReducer(s, { type: 'SUBMIT_VOTE', choice: 'A' });
    expect(s.phase).toBe('REVEAL_SUSPENSE');
    expect(s.roundOutcome?.countA).toBe(2);
    expect(s.roundOutcome?.countB).toBe(1);

    s = passReducer(s, { type: 'FINISH_SUSPENSE' });
    expect(s.phase).toBe('DEBATE');

    // Optional re-vote: Player 3 flips to B -> swingDelta = 1
    s = passReducer(s, { type: 'START_REVOTE' });
    expect(s.phase).toBe('PASS_CURTAIN');
    expect(s.secretKind).toBe('vote2');
    for (const choice of ['A', 'B', 'B'] as const) {
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      s = passReducer(s, { type: 'SUBMIT_VOTE', choice });
    }
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.kind).toBe('swing');
    expect(s.roundOutcome?.swingDelta).toBe(1);
    expect(s.roundOutcome?.countA).toBe(1);
    expect(s.roundOutcome?.countB).toBe(2);

    const awards = computePassAwards(s);
    expect(awards.some((a) => a.id === 'voltagabbana' && a.winnerId === 'p3')).toBe(true);
  });

  it('runs L’Infiltrato: picks 1 infiltrator, hides secret questions, and resolves accusation', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'infiltrato',
      players: PLAYERS_3,
      cards: FALLBACK_DECKS.infiltrato.slice(0, 1),
    });
    // rng = 0.5 -> index 1 ('p2' Giulia)
    s = passReducer(s, { type: 'BEGIN_ROUND', rng: () => 0.5 });
    expect(s.infiltratoId).toBe('p2');
    expect(s.secretKind).toBe('infiltrato_read');

    for (let i = 0; i < 3; i++) {
      expect(s.phase).toBe('PASS_CURTAIN');
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      expect(s.phase).toBe('SECRET_TURN');
      s = passReducer(s, { type: 'ACK_SECRET' });
    }
    expect(s.phase).toBe('DEBATE');

    s = passReducer(s, { type: 'START_ACCUSE' });
    expect(s.secretKind).toBe('infiltrato_accuse');

    // p1 and p3 accuse p2; p2 accuses p1
    const targets = ['p2', 'p1', 'p2'];
    for (const t of targets) {
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      s = passReducer(s, { type: 'SUBMIT_TARGET', targetId: t });
    }
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.infiltratoCaught).toBe(true);
    expect(s.roundOutcome?.infiltratoId).toBe('p2');

    s = passReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('FINAL_AWARDS');
  });

  it('runs Assurdo Gogna & Coppie Allineamento', () => {
    let s = createInitialPassState();
    s = passReducer(s, {
      type: 'START_GAME',
      mode: 'assurdo',
      players: PLAYERS_3,
      cards: [FALLBACK_DECKS.assurdo[0]], // gogna
    });
    s = passReducer(s, { type: 'BEGIN_ROUND' });
    expect(s.secretKind).toBe('gogna');
    for (const targetId of ['p1', 'p1', 'p3']) {
      s = passReducer(s, { type: 'UNLOCK_TURN' });
      s = passReducer(s, { type: 'SUBMIT_TARGET', targetId });
    }
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.roundOutcome?.gognaWinnerIds).toEqual(['p1']);
    expect(s.roundOutcome?.gognaTopVotes).toBe(2);

    // Coppie allineamento
    let c = createInitialPassState();
    c = passReducer(c, {
      type: 'START_GAME',
      mode: 'coppie',
      players: PLAYERS_2,
      cards: [FALLBACK_DECKS.coppie[0]],
    });
    c = passReducer(c, { type: 'BEGIN_ROUND' });
    expect(c.secretKind).toBe('coppie_align');
    c = passReducer(c, { type: 'UNLOCK_TURN' });
    c = passReducer(c, { type: 'SUBMIT_VOTE', choice: 'A' });
    c = passReducer(c, { type: 'UNLOCK_TURN' });
    c = passReducer(c, { type: 'SUBMIT_VOTE', choice: 'A' });
    expect(c.phase).toBe('ROUND_RESULT');
    expect(c.roundOutcome?.coppieMatched).toBe(true);
  });

  it('requires at least 3 players for Infiltrato', () => {
    const s = passReducer(createInitialPassState(), {
      type: 'START_GAME',
      mode: 'infiltrato',
      players: PLAYERS_2,
      cards: FALLBACK_DECKS.infiltrato,
    });
    expect(s.phase).toBe('SETUP');
  });
});
