import { describe, it, expect } from 'vitest';
import {
  type GamePhase,
  PHASE_DURATIONS_MS,
  nextPercorsoPhase,
} from '../phases';

describe('PHASE_DURATIONS_MS — fasi Percorso', () => {
  it('TAPPA_INTRO ha un timer (carta annuncio auto-avanzante)', () => {
    expect(PHASE_DURATIONS_MS.TAPPA_INTRO).toBeGreaterThan(0);
  });
  it('TAPPA_RECAP non ha timer (pausa: l\'host preme Continua)', () => {
    expect(PHASE_DURATIONS_MS.TAPPA_RECAP).toBeNull();
  });
});

describe('nextPercorsoPhase', () => {
  // Un percorso che parte dalla tappa 3, due dilemmi per tappa (3,3,4,4).
  const plan = [3, 3, 4, 4];

  it('PHASE_INTRO apre la prima carta-tappa (indice 0)', () => {
    expect(nextPercorsoPhase('PHASE_INTRO', 0, plan)).toEqual({ phase: 'TAPPA_INTRO', dilemmaIndex: 0 });
  });

  it('TAPPA_INTRO avanza al primo dilemma della tappa', () => {
    expect(nextPercorsoPhase('TAPPA_INTRO', 0, plan)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 1 });
    // Dopo un recap intermedio (idx=2) la carta della tappa successiva apre il 3° dilemma.
    expect(nextPercorsoPhase('TAPPA_INTRO', 2, plan)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 3 });
  });

  it('le fasi interne al dilemma scorrono come nella sequenza classica', () => {
    expect(nextPercorsoPhase('DILEMMA_REVEAL', 1, plan).phase).toBe('VOTE_1');
    expect(nextPercorsoPhase('VOTE_1', 1, plan).phase).toBe('SPLIT_REVEAL');
    expect(nextPercorsoPhase('SPLIT_REVEAL', 1, plan).phase).toBe('PREDICT');
    expect(nextPercorsoPhase('PREDICT', 1, plan).phase).toBe('DEFENSE');
    expect(nextPercorsoPhase('DEFENSE', 1, plan).phase).toBe('VOTE_2');
    expect(nextPercorsoPhase('VOTE_2', 1, plan).phase).toBe('SPEAKER_VOTE');
    expect(nextPercorsoPhase('SPEAKER_VOTE', 1, plan).phase).toBe('PHASE_RESULTS');
    // L'indice del dilemma non cambia dentro la sequenza.
    expect(nextPercorsoPhase('VOTE_1', 1, plan).dilemmaIndex).toBe(1);
  });

  it('PHASE_RESULTS: stessa tappa ⇒ prossimo dilemma', () => {
    expect(nextPercorsoPhase('PHASE_RESULTS', 1, plan)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 2 });
    expect(nextPercorsoPhase('PHASE_RESULTS', 3, plan)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 4 });
  });

  it('PHASE_RESULTS: confine di tappa ⇒ recap della tappa finita', () => {
    expect(nextPercorsoPhase('PHASE_RESULTS', 2, plan)).toEqual({ phase: 'TAPPA_RECAP', dilemmaIndex: 2 });
  });

  it('PHASE_RESULTS: ultimo dilemma ⇒ recap finale', () => {
    expect(nextPercorsoPhase('PHASE_RESULTS', 4, plan)).toEqual({ phase: 'TAPPA_RECAP', dilemmaIndex: 4 });
  });

  it('TAPPA_RECAP: restano dilemmi ⇒ carta della tappa successiva', () => {
    expect(nextPercorsoPhase('TAPPA_RECAP', 2, plan)).toEqual({ phase: 'TAPPA_INTRO', dilemmaIndex: 2 });
  });

  it('TAPPA_RECAP: vetta raggiunta ⇒ premi finali', () => {
    expect(nextPercorsoPhase('TAPPA_RECAP', 4, plan)).toEqual({ phase: 'FINAL_AWARDS', dilemmaIndex: 4 });
  });

  it('cammino completo: PHASE_INTRO → … → FINAL_AWARDS visita tutte le fasi attese', () => {
    const seq: GamePhase[] = [];
    let phase: GamePhase = 'PHASE_INTRO';
    let idx = 0;
    // Walk until FINAL_AWARDS (guard against infinite loops).
    for (let guard = 0; guard < 100 && phase !== 'FINAL_AWARDS'; guard++) {
      const t = nextPercorsoPhase(phase, idx, plan);
      phase = t.phase;
      idx = t.dilemmaIndex;
      seq.push(phase);
    }
    expect(phase).toBe('FINAL_AWARDS');
    // Two TAPPA_INTRO (one per tappa) and two TAPPA_RECAP (mid + final).
    expect(seq.filter((p) => p === 'TAPPA_INTRO')).toHaveLength(2);
    expect(seq.filter((p) => p === 'TAPPA_RECAP')).toHaveLength(2);
    expect(seq.filter((p) => p === 'DILEMMA_REVEAL')).toHaveLength(4);
  });
});
