import { describe, it, expect } from 'vitest';
import { type GamePhase, PHASE_DURATIONS_MS, nextStoriaPhase } from '../phases';

// A story of 3 crossroads (the `total` passed to nextStoriaPhase).
const TOTAL = 3;

describe('PHASE_DURATIONS_MS — fasi Storia', () => {
  it('le quattro fasi narrative non hanno timer (ritmo dal narratore)', () => {
    expect(PHASE_DURATIONS_MS.STORY_INTRO).toBeNull();
    expect(PHASE_DURATIONS_MS.SCENE_INTRO).toBeNull();
    expect(PHASE_DURATIONS_MS.SCENE_CONSEQUENCE).toBeNull();
    expect(PHASE_DURATIONS_MS.STORY_EPILOGUE).toBeNull();
  });
});

describe('nextStoriaPhase', () => {
  it('PHASE_INTRO apre la premessa della storia', () => {
    expect(nextStoriaPhase('PHASE_INTRO', 0, TOTAL)).toEqual({ phase: 'STORY_INTRO', dilemmaIndex: 0 });
  });

  it('STORY_INTRO apre la prima scena (carta narrativa)', () => {
    expect(nextStoriaPhase('STORY_INTRO', 0, TOTAL)).toEqual({ phase: 'SCENE_INTRO', dilemmaIndex: 0 });
  });

  it('SCENE_INTRO apre il bivio incrementando l\'indice', () => {
    expect(nextStoriaPhase('SCENE_INTRO', 0, TOTAL)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 1 });
    expect(nextStoriaPhase('SCENE_INTRO', 2, TOTAL)).toEqual({ phase: 'DILEMMA_REVEAL', dilemmaIndex: 3 });
  });

  it('le fasi interne al bivio seguono la sequenza classica, indice invariato', () => {
    expect(nextStoriaPhase('DILEMMA_REVEAL', 1, TOTAL).phase).toBe('VOTE_1');
    expect(nextStoriaPhase('VOTE_1', 1, TOTAL).phase).toBe('SPLIT_REVEAL');
    expect(nextStoriaPhase('SPLIT_REVEAL', 1, TOTAL).phase).toBe('PREDICT');
    expect(nextStoriaPhase('PREDICT', 1, TOTAL).phase).toBe('DEFENSE');
    expect(nextStoriaPhase('DEFENSE', 1, TOTAL).phase).toBe('VOTE_2');
    expect(nextStoriaPhase('VOTE_2', 1, TOTAL).phase).toBe('SPEAKER_VOTE');
    expect(nextStoriaPhase('SPEAKER_VOTE', 1, TOTAL).phase).toBe('PHASE_RESULTS');
    expect(nextStoriaPhase('VOTE_1', 1, TOTAL).dilemmaIndex).toBe(1);
  });

  it('PHASE_RESULTS porta alla conseguenza della scena (indice invariato)', () => {
    expect(nextStoriaPhase('PHASE_RESULTS', 1, TOTAL)).toEqual({ phase: 'SCENE_CONSEQUENCE', dilemmaIndex: 1 });
    expect(nextStoriaPhase('PHASE_RESULTS', 3, TOTAL)).toEqual({ phase: 'SCENE_CONSEQUENCE', dilemmaIndex: 3 });
  });

  it('SCENE_CONSEQUENCE apre la scena successiva finché restano bivi', () => {
    expect(nextStoriaPhase('SCENE_CONSEQUENCE', 1, TOTAL)).toEqual({ phase: 'SCENE_INTRO', dilemmaIndex: 1 });
    expect(nextStoriaPhase('SCENE_CONSEQUENCE', 2, TOTAL)).toEqual({ phase: 'SCENE_INTRO', dilemmaIndex: 2 });
  });

  it('SCENE_CONSEQUENCE dell\'ultimo bivio porta all\'epilogo', () => {
    expect(nextStoriaPhase('SCENE_CONSEQUENCE', 3, TOTAL)).toEqual({ phase: 'STORY_EPILOGUE', dilemmaIndex: 3 });
  });

  it('STORY_EPILOGUE chiude ai premi finali', () => {
    expect(nextStoriaPhase('STORY_EPILOGUE', 3, TOTAL)).toEqual({ phase: 'FINAL_AWARDS', dilemmaIndex: 3 });
  });

  it('percorre l\'intera storia in una sequenza coerente', () => {
    const seq: GamePhase[] = [];
    let phase: GamePhase = 'PHASE_INTRO';
    let idx = 0;
    // Walk until FINAL_AWARDS (guard against infinite loop).
    for (let guard = 0; guard < 200 && phase !== 'FINAL_AWARDS'; guard++) {
      const t = nextStoriaPhase(phase, idx, TOTAL);
      phase = t.phase;
      idx = t.dilemmaIndex;
      seq.push(phase);
    }
    expect(phase).toBe('FINAL_AWARDS');
    // Three SCENE_INTRO (one per bivio) and three SCENE_CONSEQUENCE, one epilogue.
    expect(seq.filter((p) => p === 'SCENE_INTRO')).toHaveLength(TOTAL);
    expect(seq.filter((p) => p === 'SCENE_CONSEQUENCE')).toHaveLength(TOTAL);
    expect(seq.filter((p) => p === 'STORY_INTRO')).toHaveLength(1);
    expect(seq.filter((p) => p === 'STORY_EPILOGUE')).toHaveLength(1);
    // Each crossroads ran a full debate round.
    expect(seq.filter((p) => p === 'PHASE_RESULTS')).toHaveLength(TOTAL);
  });
});
