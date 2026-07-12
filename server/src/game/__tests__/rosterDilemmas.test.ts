import { describe, it, expect } from 'vitest';
import { resolveRosterDilemma } from '../rosterDilemmas';
import type { Dilemma } from '../deck';

function template(over: Partial<Dilemma> = {}): Dilemma {
  return {
    id: 'rt01',
    text: '{nome} eredita 50k: cosa ci fa?',
    optionA: 'Li investe tutti',
    optionB: 'Li mette da parte',
    register: 'vita',
    roster: true,
    spuntiA: [],
    spuntiB: [],
    ...over,
  };
}

describe('resolveRosterDilemma (5.3, "contenuto combinatorio sul roster")', () => {
  it('substitutes {nome} with a random player nickname', () => {
    const d = resolveRosterDilemma(template(), ['Marco'], () => 0);
    expect(d.text).toBe('Marco eredita 50k: cosa ci fa?');
  });

  it('substitutes every occurrence, across text and both options', () => {
    const d = resolveRosterDilemma(
      template({ optionA: 'Fidati di {nome}', optionB: 'Non fidarti di {nome}' }),
      ['Bea'],
      () => 0,
    );
    expect(d.optionA).toBe('Fidati di Bea');
    expect(d.optionB).toBe('Non fidarti di Bea');
  });

  it('picks among the given nicknames using the injected rng', () => {
    const names = ['Ann', 'Bob', 'Cid'];
    expect(resolveRosterDilemma(template(), names, () => 0).text).toContain('Ann');
    expect(resolveRosterDilemma(template(), names, () => 0.99).text).toContain('Cid');
  });

  it('keeps the same id (authorship/exclusion tracking keys off the template)', () => {
    const d = resolveRosterDilemma(template(), ['Marco'], () => 0);
    expect(d.id).toBe('rt01');
  });

  it('is a no-op for a non-roster dilemma', () => {
    const normal = template({ roster: false, text: 'Un dilemma normale?' });
    expect(resolveRosterDilemma(normal, ['Marco'], () => 0)).toEqual(normal);
  });

  it('is a no-op when there is nobody to name', () => {
    const d = template();
    expect(resolveRosterDilemma(d, [], () => 0)).toEqual(d);
  });
});
