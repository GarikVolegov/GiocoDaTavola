import { describe, it, expect } from 'vitest';
import {
  STORY_GENRES,
  isStoryGenre,
  buildStoriaPlan,
  decisionForRound,
  pickEpilogo,
  countDecisionsA,
  totalScenes,
  storieCatalog,
  validateStory,
  loadStories,
  type Story,
  type StoryScene,
} from '../storie';

function scene(id: string, complessita?: 'alto' | 'max' | 'power'): StoryScene {
  return {
    id,
    narration: `Narrazione ${id}.`,
    bivio: {
      text: `Bivio ${id}?`,
      optionA: `A-${id}`,
      optionB: `B-${id}`,
      spuntiA: ['a1', 'a2'],
      spuntiB: ['b1', 'b2'],
      ...(complessita ? { complessita } : {}),
    },
    consequenceA: `Esito A di ${id}.`,
    consequenceB: `Esito B di ${id}.`,
  };
}

function makeStory(): Story {
  return {
    id: 'naufragio',
    title: 'Il Naufragio',
    genre: 'avventura',
    emoji: '🧭',
    hook: 'Una scialuppa, otto naufraghi, una sola rotta.',
    protagonist: 'Capitano Vera',
    premessa: 'La nave affonda nella tempesta.',
    acts: [
      { id: 'a1', title: 'Atto I — Alla deriva', emoji: '🌊', scenes: [scene('s1', 'alto'), scene('s2', 'max')] },
      { id: 'a2', title: 'Atto II — La terra', scenes: [scene('s3', 'power')] },
    ],
    epiloghi: [
      { minA: 0, maxA: 1, text: 'Finale cinico.' },
      { minA: 2, maxA: 3, text: 'Finale solidale.' },
    ],
    durataStimaMin: 90,
  };
}

describe('STORY_GENRES / isStoryGenre', () => {
  it('definisce i quattro generi e li riconosce', () => {
    expect([...STORY_GENRES].sort()).toEqual(['avventura', 'dramma', 'giallo', 'scifi']);
    expect(isStoryGenre('giallo')).toBe(true);
    expect(isStoryGenre('horror')).toBe(false);
    expect(isStoryGenre('')).toBe(false);
  });
});

describe('buildStoriaPlan', () => {
  it('appiattisce gli atti in scene ordinate con array paralleli', () => {
    const plan = buildStoriaPlan(makeStory());
    expect(plan.scenes.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(plan.dilemmas).toHaveLength(3);
    expect(plan.scenes).toHaveLength(3);
    expect(plan.acts).toHaveLength(3);
  });

  it('associa ogni scena al suo indice di atto (0-based)', () => {
    const plan = buildStoriaPlan(makeStory());
    expect(plan.acts).toEqual([0, 0, 1]);
  });

  it('sintetizza un Dilemma dal bivio con id univoco e campi mappati', () => {
    const plan = buildStoriaPlan(makeStory());
    expect(plan.dilemmas[0]).toMatchObject({
      id: 'story-naufragio-s1',
      text: 'Bivio s1?',
      optionA: 'A-s1',
      optionB: 'B-s1',
      register: 'vita',
      complessita: 'alto',
      spuntiA: ['a1', 'a2'],
      spuntiB: ['b1', 'b2'],
    });
    expect(new Set(plan.dilemmas.map((d) => d.id)).size).toBe(plan.dilemmas.length);
  });

  it('lascia la complessità assente quando non specificata nel bivio', () => {
    const story = makeStory();
    story.acts[0].scenes[0].bivio.complessita = undefined;
    const plan = buildStoriaPlan(story);
    expect(plan.dilemmas[0].complessita).toBeUndefined();
  });
});

describe('decisionForRound', () => {
  it('sceglie la maggioranza del secondo voto', () => {
    expect(decisionForRound({ A: 3, B: 1 }, { A: 0, B: 0 })).toBe('A');
    expect(decisionForRound({ A: 1, B: 4 }, { A: 0, B: 0 })).toBe('B');
  });
  it('in parità sul secondo voto usa il primo voto in testa', () => {
    expect(decisionForRound({ A: 2, B: 2 }, { A: 3, B: 1 })).toBe('A');
    expect(decisionForRound({ A: 2, B: 2 }, { A: 1, B: 3 })).toBe('B');
  });
  it('in parità totale ripiega su A', () => {
    expect(decisionForRound({ A: 0, B: 0 }, { A: 0, B: 0 })).toBe('A');
    expect(decisionForRound({ A: 2, B: 2 }, { A: 2, B: 2 })).toBe('A');
  });
});

describe('pickEpilogo / countDecisionsA', () => {
  it('conta le decisioni-A', () => {
    expect(countDecisionsA(['A', 'B', 'A', 'A'])).toBe(3);
    expect(countDecisionsA([])).toBe(0);
  });
  it('sceglie l’epilogo la cui fascia contiene il numero di decisioni-A', () => {
    const eps = makeStory().epiloghi;
    expect(pickEpilogo(eps, 0)).toBe('Finale cinico.');
    expect(pickEpilogo(eps, 1)).toBe('Finale cinico.');
    expect(pickEpilogo(eps, 2)).toBe('Finale solidale.');
    expect(pickEpilogo(eps, 3)).toBe('Finale solidale.');
  });
  it('se nessuna fascia combacia ripiega sull’ultimo epilogo', () => {
    const eps = makeStory().epiloghi;
    expect(pickEpilogo(eps, 99)).toBe('Finale solidale.');
  });
});

describe('totalScenes / storieCatalog', () => {
  it('conta i bivi totali della storia', () => {
    expect(totalScenes(makeStory())).toBe(3);
  });
  it('produce voci di catalogo leggere senza prosa', () => {
    const [item] = storieCatalog([makeStory()]);
    expect(item).toEqual({
      id: 'naufragio',
      title: 'Il Naufragio',
      genre: 'avventura',
      emoji: '🧭',
      hook: 'Una scialuppa, otto naufraghi, una sola rotta.',
      durataStimaMin: 90,
      scene: 3,
    });
  });
});

describe('validateStory', () => {
  it('non segnala errori per una storia ben formata', () => {
    expect(validateStory(makeStory())).toEqual([]);
  });
  it('segnala una scena senza narrazione o conseguenze', () => {
    const bad = makeStory();
    bad.acts[0].scenes[0].narration = '   ';
    bad.acts[0].scenes[1].consequenceA = '';
    const errs = validateStory(bad);
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
  it('segnala epiloghi che non coprono 0..N decisioni-A', () => {
    const bad = makeStory();
    bad.epiloghi = [{ minA: 0, maxA: 1, text: 'solo basso' }]; // manca 2..3
    expect(validateStory(bad).some((e) => /epilog/i.test(e))).toBe(true);
  });
  it('segnala opzioni A/B identiche nel bivio', () => {
    const bad = makeStory();
    bad.acts[0].scenes[0].bivio.optionB = bad.acts[0].scenes[0].bivio.optionA;
    expect(validateStory(bad).some((e) => /opzion/i.test(e))).toBe(true);
  });
});

describe('loadStories', () => {
  it('carica almeno una storia ben formata da stories.json', () => {
    const stories = loadStories();
    expect(stories.length).toBeGreaterThanOrEqual(1);
    for (const s of stories) {
      expect(validateStory(s)).toEqual([]);
      expect(totalScenes(s)).toBeGreaterThanOrEqual(1);
    }
  });
  it('non ha id di storia duplicati', () => {
    const ids = loadStories().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('catalogo storie — contenuti reali (sci-fi, bivi reali)', () => {
  const stories = loadStories();

  it('copre tutti e quattro i sotto-sapori sci-fi', () => {
    const genres = new Set(stories.map((s) => s.genre));
    expect(genres).toEqual(new Set(['avventura', 'scifi', 'giallo', 'dramma']));
  });

  it('ha almeno una storia lunga (~2h: ≥12 bivi)', () => {
    expect(Math.max(...stories.map(totalScenes))).toBeGreaterThanOrEqual(12);
  });

  it('ogni storia è strutturata in più atti ed è ben formata', () => {
    for (const s of stories) {
      expect(validateStory(s)).toEqual([]);
      expect(s.acts.length).toBeGreaterThanOrEqual(2);
      expect(s.premessa.length).toBeGreaterThan(40);
      expect(s.protagonist.trim()).not.toBe('');
    }
  });
});
