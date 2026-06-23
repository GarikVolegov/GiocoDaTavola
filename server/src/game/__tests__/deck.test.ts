import { describe, it, expect } from 'vitest';
import { Deck, loadDilemmas, dilemmasForRegister, dilemmasForTappa, type Dilemma } from '../deck';

// A small fixed deck for exercising draw behavior without depending on the
// real data file.
const fixture: Dilemma[] = [
  { id: 'a', text: 'A?', optionA: 'a1', optionB: 'a2', register: 'vita', spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
  { id: 'b', text: 'B?', optionA: 'b1', optionB: 'b2', register: 'business', spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
  { id: 'c', text: 'C?', optionA: 'c1', optionB: 'c2', register: 'vita', spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
];

describe('loadDilemmas (server/data/dilemmas.json)', () => {
  it('loads at least 20 dilemmas', () => {
    expect(loadDilemmas().length).toBeGreaterThanOrEqual(20);
  });

  it('every dilemma has a non-empty text, optionA and optionB', () => {
    for (const d of loadDilemmas()) {
      expect(d.text.trim()).not.toBe('');
      expect(d.optionA.trim()).not.toBe('');
      expect(d.optionB.trim()).not.toBe('');
    }
  });

  it('dilemma ids are unique', () => {
    const dilemmas = loadDilemmas();
    const ids = new Set(dilemmas.map((d) => d.id));
    expect(ids.size).toBe(dilemmas.length);
  });
});

describe('Deck', () => {
  it('draws without repeats within a single game', () => {
    const deck = new Deck(fixture);
    const drawn = [deck.draw(), deck.draw(), deck.draw()].map((d) => d?.id);
    // Three draws, no id appears twice, and every fixture id is covered.
    expect(new Set(drawn).size).toBe(3);
    expect([...drawn].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns null once the deck is exhausted', () => {
    const deck = new Deck(fixture);
    deck.draw();
    deck.draw();
    deck.draw();
    expect(deck.draw()).toBeNull();
  });

  it('reports how many dilemmas remain', () => {
    const deck = new Deck(fixture);
    expect(deck.remainingCount).toBe(3);
    deck.draw();
    expect(deck.remainingCount).toBe(2);
  });

  it('uses the injectable RNG to pick (deterministic)', () => {
    // rng always returns 0 -> always picks index 0, walking the deck in order.
    const deck = new Deck(fixture, () => 0);
    expect(deck.draw()?.id).toBe('a');
    expect(deck.draw()?.id).toBe('b');
    expect(deck.draw()?.id).toBe('c');
  });

  it('does not mutate the source array', () => {
    const source = [...fixture];
    const deck = new Deck(source);
    deck.draw();
    deck.draw();
    deck.draw();
    expect(source).toHaveLength(3);
  });

  it('draws the real deck with no repeats across a full game', () => {
    const dilemmas = loadDilemmas();
    const deck = new Deck(dilemmas);
    const seen = new Set<string>();
    for (let i = 0; i < dilemmas.length; i++) {
      const d = deck.draw();
      expect(d).not.toBeNull();
      expect(seen.has(d!.id)).toBe(false);
      seen.add(d!.id);
    }
    expect(deck.draw()).toBeNull();
  });
});

describe('dilemmasForRegister', () => {
  const all = loadDilemmas();

  it('misto restituisce tutti i dilemmi', () => {
    expect(dilemmasForRegister(all, 'misto')).toHaveLength(all.length);
  });

  it('vita restituisce solo i dilemmi taggati vita', () => {
    const vita = dilemmasForRegister(all, 'vita');
    expect(vita.length).toBeGreaterThan(0);
    expect(vita.every((d) => d.register === 'vita')).toBe(true);
  });

  it('business restituisce solo i dilemmi taggati business', () => {
    const biz = dilemmasForRegister(all, 'business');
    expect(biz.length).toBeGreaterThan(0);
    expect(biz.every((d) => d.register === 'business')).toBe(true);
  });

  it('ogni registro ha abbastanza dilemmi per il formato più lungo (Maratona = 7)', () => {
    expect(dilemmasForRegister(all, 'vita').length).toBeGreaterThanOrEqual(8);
    expect(dilemmasForRegister(all, 'business').length).toBeGreaterThanOrEqual(8);
  });

  it('ogni dilemma è taggato vita, business o carriera', () => {
    expect(
      all.every((d) => d.register === 'vita' || d.register === 'business' || d.register === 'carriera'),
    ).toBe(true);
  });

  it('carriera restituisce solo i dilemmi taggati carriera, e ce ne sono abbastanza', () => {
    const car = dilemmasForRegister(all, 'carriera');
    expect(car.length).toBeGreaterThanOrEqual(10);
    expect(car.every((d) => d.register === 'carriera')).toBe(true);
  });
});

describe('deck content volume & balance', () => {
  const all = loadDilemmas();

  it('ha almeno 60 dilemmi per la rigiocabilità', () => {
    expect(all.length).toBeGreaterThanOrEqual(60);
  });

  it('è bilanciato: almeno 28 dilemmi per registro', () => {
    expect(dilemmasForRegister(all, 'vita').length).toBeGreaterThanOrEqual(28);
    expect(dilemmasForRegister(all, 'business').length).toBeGreaterThanOrEqual(28);
  });

  it('le due opzioni di ogni dilemma sono diverse tra loro', () => {
    for (const d of all) {
      expect(d.optionA.trim()).not.toBe(d.optionB.trim());
    }
  });

  it('non ci sono testi di dilemma duplicati', () => {
    const texts = all.map((d) => d.text.trim().toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('spunti per lato', () => {
  it('every dilemma has at least two non-empty spunti per side', () => {
    for (const d of loadDilemmas()) {
      expect(d.spuntiA.length).toBeGreaterThanOrEqual(2);
      expect(d.spuntiB.length).toBeGreaterThanOrEqual(2);
      for (const s of [...d.spuntiA, ...d.spuntiB]) {
        expect(s.trim()).not.toBe('');
      }
    }
  });
});

describe('dilemmasForTappa (modalità Percorso)', () => {
  const tagged: Dilemma[] = [
    { id: 't1a', text: 'T1?', optionA: 'a', optionB: 'b', register: 'vita', tappa: 1, spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
    { id: 't1b', text: 'T1b?', optionA: 'a', optionB: 'b', register: 'vita', tappa: 1, spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
    { id: 't2a', text: 'T2?', optionA: 'a', optionB: 'b', register: 'vita', tappa: 2, spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
    { id: 'untagged', text: 'U?', optionA: 'a', optionB: 'b', register: 'business', spuntiA: ['x', 'y'], spuntiB: ['x', 'y'] },
  ];

  it('restituisce solo i dilemmi della tappa richiesta', () => {
    expect(dilemmasForTappa(tagged, 1).map((d) => d.id)).toEqual(['t1a', 't1b']);
    expect(dilemmasForTappa(tagged, 2).map((d) => d.id)).toEqual(['t2a']);
  });

  it('ignora i dilemmi senza tappa (riservati alla modalità classica)', () => {
    const all = dilemmasForTappa(tagged, 1).concat(dilemmasForTappa(tagged, 2));
    expect(all.some((d) => d.id === 'untagged')).toBe(false);
  });

  it('restituisce un array vuoto per una tappa senza dilemmi', () => {
    expect(dilemmasForTappa(tagged, 4)).toEqual([]);
  });
});

describe('contenuti Percorso (tappe)', () => {
  const all = loadDilemmas();

  it('ogni tappa ha almeno 10 dilemmi (basta per ~3h dal livello 1)', () => {
    for (const t of [1, 2, 3, 4] as const) {
      expect(dilemmasForTappa(all, t).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('ogni dilemma con tappa ha una tappa valida (1..4) e spunti per lato', () => {
    for (const d of all) {
      if (d.tappa === undefined) continue;
      expect([1, 2, 3, 4]).toContain(d.tappa);
      expect(d.spuntiA.length).toBeGreaterThanOrEqual(2);
      expect(d.spuntiB.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('il percorso attinge da entrambi i registri (collocazione Percorso + Classica)', () => {
    const tagged = all.filter((d) => d.tappa !== undefined);
    // I dilemmi taggati possono essere sia 'vita' sia 'business': lo stesso dilemma
    // vive nella salita (per tappa) e nelle partite classiche (per registro).
    expect(tagged.some((d) => d.register === 'vita')).toBe(true);
    expect(tagged.some((d) => d.register === 'business')).toBe(true);
  });
});

describe('classificazione complessità (alto < max < power)', () => {
  const all = loadDilemmas();

  it('ogni dilemma ha una complessità valida (pavimento alto, niente banali)', () => {
    for (const d of all) {
      expect(['alto', 'max', 'power']).toContain(d.complessita);
    }
  });

  it('il deck copre tutti e tre i livelli di complessità', () => {
    expect(new Set(all.map((d) => d.complessita))).toEqual(new Set(['alto', 'max', 'power']));
  });

  it('le tappe profonde sono più complesse: tappa 4 è sempre power, tappa 3 mai alto', () => {
    expect(all.filter((d) => d.tappa === 4).every((d) => d.complessita === 'power')).toBe(true);
    expect(all.filter((d) => d.tappa === 3).every((d) => d.complessita !== 'alto')).toBe(true);
  });
});

describe('Deck.cards (snapshot support)', () => {
  it('exposes the remaining cards and shrinks as they are drawn', () => {
    const deck = new Deck(fixture, () => 0);
    expect(deck.cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    deck.draw(); // rng=0 picks index 0 -> 'a'
    expect(deck.cards.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('returns a copy (mutating the result does not change the deck)', () => {
    const deck = new Deck(fixture);
    deck.cards.pop();
    expect(deck.remainingCount).toBe(fixture.length);
  });
});
