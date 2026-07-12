import { describe, it, expect } from 'vitest';
import { buildClassicPlan, replaceCurrentDilemma } from '../dilemmaPlan';
import { Deck, type Dilemma, type Complessita } from '../deck';
import { RoomStore, type Room } from '../rooms';

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

describe('buildClassicPlan — submitted (UGC) dilemmas are spread out, not front-loaded (5.2)', () => {
  const usr = (id: string): Dilemma => ({ id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita' });

  it("doesn't open the game with a submitted dilemma when the deck offers an alternative", () => {
    const deck = new Deck([fixture('d1', 'alto'), fixture('d2', 'alto'), fixture('d3', 'alto')], () => 0);
    const submitted = [usr('usr-1')];
    const plan = buildClassicPlan(deck, submitted, 4, () => 0);
    expect(plan.map((d) => d.id)).toContain('usr-1'); // still played…
    expect(plan[0].id).not.toBe('usr-1'); // …just not as the opener
  });

  it('never places two submitted dilemmas back to back when enough deck dilemmas exist to space them out', () => {
    const deck = new Deck(
      [fixture('d1', 'alto'), fixture('d2', 'alto'), fixture('d3', 'alto')],
      () => 0,
    );
    const submitted = [usr('usr-1'), usr('usr-2')];
    const plan = buildClassicPlan(deck, submitted, 5, () => 0);
    for (let i = 0; i < plan.length - 1; i++) {
      const bothUgc = plan[i].id.startsWith('usr-') && plan[i + 1].id.startsWith('usr-');
      expect(bothUgc).toBe(false);
    }
    expect(plan.map((d) => d.id).sort()).toEqual(['d1', 'd2', 'd3', 'usr-1', 'usr-2']);
  });

  it('degenerates gracefully (no crash, nothing dropped) when the game is entirely player-submitted', () => {
    const deck = new Deck([], () => 0);
    const submitted = [usr('usr-1'), usr('usr-2'), usr('usr-3')];
    const plan = buildClassicPlan(deck, submitted, 3, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['usr-1', 'usr-2', 'usr-3']);
  });

  it('caps submitted dilemmas at the requested count, leaving the rest for the caller to carry forward', () => {
    const deck = new Deck([], () => 0);
    const submitted = [usr('usr-1'), usr('usr-2'), usr('usr-3'), usr('usr-4')];
    const plan = buildClassicPlan(deck, submitted, 2, () => 0);
    expect(plan.length).toBe(2);
  });
});

describe('buildClassicPlan — pool hygiene: famiglia + bilanciamento (5.4)', () => {
  function famiglia(id: string, fam: string): Dilemma {
    return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', famiglia: fam };
  }
  function sbilanciato(id: string): Dilemma {
    return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', bilanciamento: 'sbilanciato' };
  }

  it('draws at most one dilemma per famiglia when enough other content exists', () => {
    const deck = new Deck(
      [famiglia('f1', 'segreto'), famiglia('f2', 'segreto'), fixture('d1', 'alto'), fixture('d2', 'alto')],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    const fromFamily = plan.filter((d) => d.famiglia === 'segreto');
    expect(fromFamily.length).toBe(1);
    expect(plan.length).toBe(3); // still a full game — the rejected sibling didn't shortchange it
  });

  it('a lone family member draws normally alongside unrelated content', () => {
    const deck = new Deck([famiglia('f1', 'segreto'), fixture('d1', 'alto'), fixture('d2', 'alto')], () => 0);
    const plan = buildClassicPlan(deck, [], 3, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['d1', 'd2', 'f1']);
  });

  it('backfills a same-family repeat rather than shortchanging the game when the deck has nothing else', () => {
    const deck = new Deck([famiglia('f1', 'segreto'), famiglia('f2', 'segreto')], () => 0);
    const plan = buildClassicPlan(deck, [], 2, () => 0);
    expect(plan.map((d) => d.id).sort()).toEqual(['f1', 'f2']); // both played: a repeat beats 1 round short
  });

  it('never places two "sbilanciato" dilemmas back to back when enough balanced content exists', () => {
    const deck = new Deck(
      [sbilanciato('s1'), sbilanciato('s2'), fixture('d1', 'alto'), fixture('d2', 'alto')],
      () => 0,
    );
    const plan = buildClassicPlan(deck, [], 4, () => 0);
    for (let i = 0; i < plan.length - 1; i++) {
      const bothFlat = plan[i].bilanciamento === 'sbilanciato' && plan[i + 1].bilanciamento === 'sbilanciato';
      expect(bothFlat).toBe(false);
    }
  });
});

describe('replaceCurrentDilemma (scarta-e-rimpiazza, stesso round)', () => {
  function fixture(id: string, famiglia?: string): Dilemma {
    return { id, text: `${id}?`, optionA: 'A', optionB: 'B', register: 'vita', famiglia };
  }
  function roomWith(planned: Dilemma[], deckCards: Dilemma[], dilemmaIndex = 1): Room {
    const store = new RoomStore();
    const { code } = store.create();
    const room = store.get(code)!;
    room.plannedDilemmas = [...planned];
    room.deck = new Deck(deckCards, () => 0);
    room.dilemmaIndex = dilemmaIndex;
    return room;
  }

  it('swaps the current planned dilemma for a deck card and excludes the discarded id', () => {
    const room = roomWith([fixture('old')], [fixture('fresh')]);
    expect(replaceCurrentDilemma(room)).toBe(true);
    expect(room.plannedDilemmas[0].id).toBe('fresh');
    expect(room.excludeDilemmaIds.has('old')).toBe(true);
  });

  it('replaces at the CURRENT index, leaving other rounds untouched', () => {
    const room = roomWith([fixture('d1'), fixture('d2'), fixture('d3')], [fixture('fresh')], 2);
    expect(replaceCurrentDilemma(room)).toBe(true);
    expect(room.plannedDilemmas.map((d) => d.id)).toEqual(['d1', 'fresh', 'd3']);
  });

  it('respects the famiglia rule: skips a same-family card when a neutral one exists, returning the set-aside to the deck', () => {
    const room = roomWith(
      [fixture('old'), fixture('cugino', 'segreto')],
      [fixture('rivale', 'segreto'), fixture('neutro')],
    );
    expect(replaceCurrentDilemma(room)).toBe(true);
    expect(room.plannedDilemmas[0].id).toBe('neutro');
    expect(room.deck!.remainingCount).toBe(1); // 'rivale' set aside, then put back
  });

  it("frees up the OLD dilemma's own family — it's being discarded, so it no longer counts as \"used\"", () => {
    // 'old' (fam=segreto) is the one being thrown away; the deck offers a
    // sibling card first, then a neutral one. The sibling must NOT be treated
    // as a collision — nothing else planned belongs to 'segreto' once 'old' is gone.
    const room = roomWith([fixture('old', 'segreto')], [fixture('erede', 'segreto'), fixture('neutro')]);
    expect(replaceCurrentDilemma(room)).toBe(true);
    expect(room.plannedDilemmas[0].id).toBe('erede');
    expect(room.deck!.remainingCount).toBe(1); // 'neutro' never even drawn
  });

  it('backfills a same-family repeat when the deck has nothing else (a repeat beats no replacement)', () => {
    const room = roomWith(
      [fixture('old'), fixture('cugino', 'segreto')],
      [fixture('rivale', 'segreto')],
    );
    expect(replaceCurrentDilemma(room)).toBe(true);
    expect(room.plannedDilemmas[0].id).toBe('rivale');
  });

  it('returns false on an exhausted deck, leaving the plan untouched', () => {
    const room = roomWith([fixture('old')], []);
    expect(replaceCurrentDilemma(room)).toBe(false);
    expect(room.plannedDilemmas[0].id).toBe('old');
    expect(room.excludeDilemmaIds.has('old')).toBe(false);
  });

  it('returns false when the room has no deck (percorso/storia)', () => {
    const room = roomWith([fixture('old')], []);
    room.deck = null;
    expect(replaceCurrentDilemma(room)).toBe(false);
  });
});
