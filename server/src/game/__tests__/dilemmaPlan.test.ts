import { describe, it, expect } from 'vitest';
import { buildClassicPlan } from '../dilemmaPlan';
import { Deck, type Dilemma, type Complessita } from '../deck';

function fixture(id: string, complessita: Complessita): Dilemma {
  return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', complessita };
}

describe('buildClassicPlan — pacing rules (2.1)', () => {
  it('opens round 1 with a sorbetto dilemma whenever one was drawn', () => {
    const deck = new Deck(
      [fixture('power1', 'power'), fixture('sorbetto1', 'sorbetto'), fixture('alto1', 'alto')],
      () => 0, // always draws index 0 (front of the remaining array each time)
    );
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    expect(plan[0].complessita).toBe('sorbetto');
  });

  it('never opens round 1 with power, even with no sorbetto available', () => {
    const deck = new Deck(
      [fixture('power1', 'power'), fixture('alto1', 'alto'), fixture('max1', 'max')],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    expect(plan[0].complessita).not.toBe('power');
  });

  it('never ends the game on power, even with no sorbetto available', () => {
    const deck = new Deck(
      [fixture('alto1', 'alto'), fixture('max1', 'max'), fixture('power1', 'power')],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    expect(plan[plan.length - 1].complessita).not.toBe('power');
  });

  it('never places two max/power dilemmas back to back when enough lighter ones exist to space them out', () => {
    // 3 heavy (max1, max2, power1) + 3 light (sorbetto1, alto1, alto2) — just
    // enough light dilemmas to fully separate the heavy ones (H,N,H,N,H).
    const deck = new Deck(
      [
        fixture('sorbetto1', 'sorbetto'),
        fixture('max1', 'max'),
        fixture('alto1', 'alto'),
        fixture('max2', 'max'),
        fixture('alto2', 'alto'),
        fixture('power1', 'power'),
      ],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 6, () => 0);
    for (let i = 0; i < plan.length - 1; i++) {
      const bothHeavy =
        (plan[i].complessita === 'max' || plan[i].complessita === 'power') &&
        (plan[i + 1].complessita === 'max' || plan[i + 1].complessita === 'power');
      expect(bothHeavy).toBe(false);
    }
  });

  it('accepts an unavoidable heavy-adjacent pair when there truly is not enough light content to separate them', () => {
    // 3 heavy (max1, max2, power1) + only 1 light (alto1) besides the fixed
    // sorbetto opener — pigeonhole guarantees at least one heavy pair touches.
    const deck = new Deck(
      [
        fixture('sorbetto1', 'sorbetto'),
        fixture('max1', 'max'),
        fixture('max2', 'max'),
        fixture('alto1', 'alto'),
        fixture('power1', 'power'),
      ],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 5, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['alto1', 'max1', 'max2', 'power1', 'sorbetto1']);
    expect(plan[0].complessita).toBe('sorbetto'); // still honored even though spacing can't be
  });

  it('keeps every drawn dilemma (same set, just reordered) with only sorbetto/alto/max', () => {
    const deck = new Deck(
      [fixture('sorbetto1', 'sorbetto'), fixture('alto1', 'alto'), fixture('alto2', 'alto'), fixture('max1', 'max')],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 4, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['alto1', 'alto2', 'max1', 'sorbetto1']);
  });

  it('degenerates gracefully (no crash) when every dilemma is heavy', () => {
    const deck = new Deck([fixture('max1', 'max'), fixture('power1', 'power'), fixture('max2', 'max')], () => 0);
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['max1', 'max2', 'power1']);
  });

  it('a 1-dilemma game is left untouched by the pacing pass', () => {
    const deck = new Deck([fixture('power1', 'power')], () => 0);
    const plan = buildClassicPlan(deck, [], 1, () => 0);
    expect(plan).toEqual([fixture('power1', 'power')]);
  });
});
