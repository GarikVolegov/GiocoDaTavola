import { describe, it, expect } from 'vitest';
import { pickMusicThemeForGame, pickMusicThemeForPass } from './thematicMusic';
import type { GameStatePayload } from '../../shared/events';

function makeGame(overrides: Partial<GameStatePayload> = {}): GameStatePayload {
  return {
    code: 'ABCD',
    phase: 'LOBBY',
    round: 0,
    totalRounds: 5,
    mode: 'gruppo',
    partyMode: null,
    dilemma: null,
    ...overrides,
  } as GameStatePayload;
}

describe('thematicMusic', () => {
  it('picks lobby in LOBBY and party in FINAL_AWARDS', () => {
    expect(pickMusicThemeForGame(null)).toBe('lobby');
    expect(pickMusicThemeForGame(makeGame({ phase: 'LOBBY' }))).toBe('lobby');
    expect(pickMusicThemeForGame(makeGame({ phase: 'FINAL_AWARDS' }))).toBe('party');
  });

  it('adapts to partyMode (infiltrato -> sneaky, coppie -> chill, flash -> party)', () => {
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'infiltrato' }))).toBe('sneaky');
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'coppie' }))).toBe('chill');
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'flash' }))).toBe('party');
  });

  it('adapts to dilemma complexity', () => {
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd1', text: 'x', optionA: 'a', optionB: 'b', complessita: 'power' },
        }),
      ),
    ).toBe('tension');
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd2', text: 'x', optionA: 'a', optionB: 'b', complessita: 'sorbetto' },
        }),
      ),
    ).toBe('party');
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd3', text: 'x', optionA: 'a', optionB: 'b', complessita: 'alto' },
        }),
      ),
    ).toBe('chill');
  });

  it('picks Pass & Play themes by mode and phase', () => {
    expect(pickMusicThemeForPass('infiltrato', 'c1', 'CARD_INTRO')).toBe('sneaky');
    expect(pickMusicThemeForPass('coppie', 'c1', 'CARD_INTRO')).toBe('chill');
    expect(pickMusicThemeForPass('flash', 'c1', 'DEBATE')).toBe('tension');
    expect(pickMusicThemeForPass('flash', 'c1', 'CARD_INTRO')).toBe('party');
  });

  it('varies music across rounds and options (party intensity, stories, percorsi, caos)', () => {
    // Round-to-round variety in party modes
    const r1 = pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'infiltrato', dilemmaIndex: 1 }));
    const r2 = pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'infiltrato', dilemmaIndex: 2 }));
    expect(r1).not.toBe(r2);

    // Coppie intensity
    const piccante = pickMusicThemeForGame(
      makeGame({
        phase: 'VOTE_1',
        partyMode: 'coppie',
        partyCard: { mode: 'coppie', intensity: 'piccante', prompt: 'x' },
      }),
    );
    expect(piccante).toBe('synth:velvet-spark');

    // Serata Mix adapts to active card mode
    const mixInfiltrato = pickMusicThemeForGame(
      makeGame({
        phase: 'VOTE_1',
        partyMode: 'mix',
        partyCard: { mode: 'infiltrato', prompt: 'x' },
      }),
    );
    expect(mixInfiltrato).toBe('sneaky');

    // Storie genres
    const scifi = pickMusicThemeForGame(
      makeGame({
        phase: 'SCENE_INTRO',
        storia: {
          storyId: 's1',
          title: 'Orbita',
          protagonist: 'A',
          emoji: '🚀',
          premessa: 'p',
          actTitle: null,
          sceneNarration: null,
          sceneIndex: 0,
          totalScenes: 3,
          decision: null,
          consequence: null,
          epilogo: null,
          decisionsA: 0,
        },
        storieCatalog: [{ id: 's1', title: 'Orbita', genre: 'scifi', emoji: '🚀', hook: 'h', durataStimaMin: 10, scene: 3 }],
      }),
    );
    expect(scifi).toBe('synth:cyber-scifi');

    // Percorsi corsie
    const serio = pickMusicThemeForGame(
      makeGame({
        phase: 'VOTE_1',
        percorso: {
          percorsoId: 'etica-estremi',
          currentTappa: 1,
          tappe: [],
        } as GameStatePayload['percorso'],
      }),
    );
    expect(['synth:dramatic-piano', 'chill', 'synth:ethics-tension', 'tension']).toContain(serio);

    // Pass & Play variety with options
    const p1 = pickMusicThemeForPass('coppie', 'c1', 'CARD_INTRO', { intensity: 'piccante', roundIndex: 0 });
    const p2 = pickMusicThemeForPass('coppie', 'c2', 'CARD_INTRO', { intensity: 'piccante', roundIndex: 1 });
    expect(p1).not.toBe(p2);
  });
});
