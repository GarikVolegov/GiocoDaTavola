import { describe, expect, it } from 'vitest';
import type { Dilemma } from '../deck';
import { pickBestReplacement, scoreCandidate, selectMatchedSequence } from '../matcher';

const makeDilemma = (overrides: Partial<Dilemma> & { id: string }): Dilemma => ({
  text: `Test dilemma ${overrides.id}`,
  optionA: 'Scelta A',
  optionB: 'Scelta B',
  register: 'vita',
  spuntiA: ['Spunto A1', 'Spunto A2'],
  spuntiB: ['Spunto B1', 'Spunto B2'],
  ...overrides,
});

describe('Intelligent Dilemma Matching Engine (matcher.ts)', () => {
  it('heavily penalizes excluded (already-seen) dilemmas, except roster templates', () => {
    const regular = makeDilemma({ id: 'd1', temi: ['soldi'] });
    const roster = makeDilemma({ id: 'd2', roster: true, text: 'Cosa fa {nome}?', temi: ['amicizia'] });
    const excludeIds = new Set(['d1', 'd2']);

    const scoreRegular = scoreCandidate(regular, { alreadyPicked: [], excludeIds, playerCount: 4 });
    const scoreRoster = scoreCandidate(roster, { alreadyPicked: [], excludeIds, playerCount: 4 });

    expect(scoreRegular).toBeLessThan(0);
    expect(scoreRoster).toBeGreaterThan(scoreRegular);
  });

  it('penalizes repeating the same famiglia in a single game', () => {
    const prev = makeDilemma({ id: 'a1', famiglia: 'trolley', temi: ['etica'] });
    const sameFam = makeDilemma({ id: 'a2', famiglia: 'trolley', temi: ['etica'] });
    const freshFam = makeDilemma({ id: 'a3', famiglia: 'altro', temi: ['tempo'] });

    const sSame = scoreCandidate(sameFam, { alreadyPicked: [prev] });
    const sFresh = scoreCandidate(freshFam, { alreadyPicked: [prev] });

    expect(sSame).toBeLessThan(-400);
    expect(sFresh).toBeGreaterThan(sSame);
  });

  it('alternates themes and psychological dynamics to prevent monotony', () => {
    const d1 = makeDilemma({ id: '1', temi: ['soldi'], dinamica: 'priorita', polarizzazione: 'alta' });
    const d2SameTheme = makeDilemma({ id: '2', temi: ['soldi'], dinamica: 'priorita', polarizzazione: 'alta' });
    const d3FreshTheme = makeDilemma({ id: '3', temi: ['amicizia'], dinamica: 'relazione', polarizzazione: 'alta' });

    const seq = selectMatchedSequence([d1, d2SameTheme, d3FreshTheme], {
      count: 3,
      rng: () => 0,
      topK: 1,
    });

    // After picking one 'soldi' item, the engine should immediately switch to 'amicizia' before returning to 'soldi'.
    expect(seq[1].id).toBe('3');
  });

  it('boosts high-polarization candidates during pickBestReplacement', () => {
    const prev = makeDilemma({ id: 'prev', temi: ['lavoro'], polarizzazione: 'bassa' });
    const lowPol = makeDilemma({ id: 'low', temi: ['tempo'], polarizzazione: 'bassa' });
    const highPol = makeDilemma({ id: 'high', temi: ['etica'], polarizzazione: 'alta' });

    const chosen = pickBestReplacement(
      [lowPol, highPol],
      { alreadyPicked: [prev], boostPolarization: true },
      () => 0,
    );

    expect(chosen?.id).toBe('high');
  });

  it('produces deterministic sequences when given a deterministic rng', () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeDilemma({
        id: `d${i}`,
        temi: [i % 2 === 0 ? 'soldi' : 'amore'],
        complessita: i < 3 ? 'sorbetto' : i < 7 ? 'alto' : 'power',
      }),
    );

    const a = selectMatchedSequence(pool, { count: 6, useArc: true, rng: () => 0.25 });
    const b = selectMatchedSequence(pool, { count: 6, useArc: true, rng: () => 0.25 });
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
  });
  it('prioritizes vecchi_amici dilemmas when familiarita is vecchi_amici and vice versa', () => {
    const va = { id: 'va', text: 'va', optionA: 'A', optionB: 'B', register: 'vita' as const, familiarita: 'vecchi_amici' as const, spuntiA: [], spuntiB: [] };
    const nc = { id: 'nc', text: 'nc', optionA: 'A', optionB: 'B', register: 'vita' as const, familiarita: 'nuove_conoscenze' as const, spuntiA: [], spuntiB: [] };
    const tu = { id: 'tu', text: 'tu', optionA: 'A', optionB: 'B', register: 'vita' as const, familiarita: 'tutti' as const, spuntiA: [], spuntiB: [] };

    expect(scoreCandidate(va, { alreadyPicked: [], familiarita: 'vecchi_amici' })).toBeGreaterThan(
      scoreCandidate(tu, { alreadyPicked: [], familiarita: 'vecchi_amici' }),
    );
    expect(scoreCandidate(tu, { alreadyPicked: [], familiarita: 'vecchi_amici' })).toBeGreaterThan(
      scoreCandidate(nc, { alreadyPicked: [], familiarita: 'vecchi_amici' }),
    );
    expect(scoreCandidate(nc, { alreadyPicked: [], familiarita: 'nuove_conoscenze' })).toBeGreaterThan(
      scoreCandidate(va, { alreadyPicked: [], familiarita: 'nuove_conoscenze' }),
    );
  });
});
