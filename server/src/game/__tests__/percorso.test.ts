import { describe, it, expect } from 'vitest';
import {
  buildPercorsoPlan,
  allocateBudget,
  DURATA_BUDGET,
  TAPPE,
  N_TAPPE,
  tappaCounts,
  isDurata,
} from '../percorso';
import type { Dilemma, Tappa } from '../deck';

function makePool(tappa: Tappa, n: number): Dilemma[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${tappa}-${i}`,
    text: `dilemma ${tappa}-${i}?`,
    optionA: 'a',
    optionB: 'b',
    register: 'vita' as const,
    tappa,
    spuntiA: ['x', 'y'],
    spuntiB: ['x', 'y'],
  }));
}

// 12 dilemmas per tappa — plenty so capping never bites with the default budgets.
const big: Dilemma[] = ([1, 2, 3, 4] as Tappa[]).flatMap((t) => makePool(t, 12));

function countByTappa(plan: { tappe: number[] }): Record<number, number> {
  const c: Record<number, number> = {};
  for (const t of plan.tappe) c[t] = (c[t] ?? 0) + 1;
  return c;
}

describe('TAPPE metadata', () => {
  it('definisce esattamente 4 tappe con id 1..4 ascendenti', () => {
    expect(TAPPE).toHaveLength(N_TAPPE);
    expect(TAPPE.map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });
  it('ogni tappa ha nome, emoji e descrizione non vuoti', () => {
    for (const t of TAPPE) {
      expect(t.nome.trim()).not.toBe('');
      expect(t.emoji.trim()).not.toBe('');
      expect(t.descrizione.trim()).not.toBe('');
    }
  });
});

describe('isDurata', () => {
  it('accetta i preset validi e rifiuta il resto', () => {
    expect(isDurata('corto')).toBe(true);
    expect(isDurata('medio')).toBe(true);
    expect(isDurata('lungo')).toBe(true);
    expect(isDurata('xl')).toBe(false);
    expect(isDurata('')).toBe(false);
  });
});

describe('allocateBudget', () => {
  it('distribuisce il budget tra le tappe rimanenti, extra alle tappe più profonde', () => {
    // lungo = 30 su 4 tappe -> base 7, resto 2 -> le ultime due tappe +1
    expect(allocateBudget(1, 'lungo')).toEqual({ 1: 7, 2: 7, 3: 8, 4: 8 });
    // medio = 20 su 4 tappe -> 5 ciascuna
    expect(allocateBudget(1, 'medio')).toEqual({ 1: 5, 2: 5, 3: 5, 4: 5 });
    // corto = 10 su 4 tappe -> base 2, resto 2 -> tappe 3 e 4 +1
    expect(allocateBudget(1, 'corto')).toEqual({ 1: 2, 2: 2, 3: 3, 4: 3 });
  });

  it('parte dalla tappa scelta: le tappe precedenti hanno 0', () => {
    expect(allocateBudget(3, 'lungo')).toEqual({ 1: 0, 2: 0, 3: 15, 4: 15 });
    expect(allocateBudget(4, 'medio')).toEqual({ 1: 0, 2: 0, 3: 0, 4: 20 });
  });

  it('la somma delle allocazioni è uguale al budget della durata', () => {
    for (const start of [1, 2, 3, 4]) {
      const alloc = allocateBudget(start, 'lungo');
      const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
      expect(sum).toBe(DURATA_BUDGET.lungo);
    }
  });
});

describe('buildPercorsoPlan', () => {
  it('produce un piano della dimensione del budget quando i pool bastano', () => {
    const plan = buildPercorsoPlan(big, 1, 'lungo');
    expect(plan.dilemmas).toHaveLength(DURATA_BUDGET.lungo);
    expect(plan.tappe).toHaveLength(plan.dilemmas.length);
    expect(countByTappa(plan)).toEqual({ 1: 7, 2: 7, 3: 8, 4: 8 });
  });

  it('le tappe del piano sono in ordine ascendente (la salita)', () => {
    const plan = buildPercorsoPlan(big, 1, 'lungo');
    for (let i = 1; i < plan.tappe.length; i++) {
      expect(plan.tappe[i]).toBeGreaterThanOrEqual(plan.tappe[i - 1]);
    }
  });

  it('nessun dilemma ripetuto e ogni dilemma appartiene alla tappa dichiarata', () => {
    const plan = buildPercorsoPlan(big, 1, 'lungo');
    expect(new Set(plan.dilemmas.map((d) => d.id)).size).toBe(plan.dilemmas.length);
    plan.dilemmas.forEach((d, i) => expect(d.tappa).toBe(plan.tappe[i]));
  });

  it('parte dalla tappa scelta (salita più corta se si parte in alto)', () => {
    const plan = buildPercorsoPlan(big, 3, 'lungo');
    expect(new Set(plan.tappe)).toEqual(new Set([3, 4]));
  });

  it('cappa per disponibilità: pool piccoli ⇒ piano più corto del budget', () => {
    const small = ([3, 4] as Tappa[]).flatMap((t) => makePool(t, 10)); // solo 10/tappa
    const plan = buildPercorsoPlan(small, 3, 'lungo'); // chiederebbe 15+15
    expect(plan.dilemmas).toHaveLength(20); // capped a 10+10
    expect(countByTappa(plan)).toEqual({ 3: 10, 4: 10 });
  });

  it('è deterministico con un rng iniettato', () => {
    const a = buildPercorsoPlan(big, 1, 'medio', () => 0);
    const b = buildPercorsoPlan(big, 1, 'medio', () => 0);
    expect(a.dilemmas.map((d) => d.id)).toEqual(b.dilemmas.map((d) => d.id));
  });

  it('clampa una tappa di partenza fuori range a [1..4]', () => {
    expect(new Set(buildPercorsoPlan(big, 0, 'corto').tappe).size).toBeGreaterThan(0);
    expect(new Set(buildPercorsoPlan(big, 9, 'corto').tappe)).toEqual(new Set([4]));
  });
});

describe('tappaCounts', () => {
  it('conta i dilemmi disponibili per tappa', () => {
    expect(tappaCounts(big)).toEqual({ 1: 12, 2: 12, 3: 12, 4: 12 });
  });
  it('le tappe senza dilemmi valgono 0', () => {
    const onlyT1 = makePool(1, 5);
    expect(tappaCounts(onlyT1)).toEqual({ 1: 5, 2: 0, 3: 0, 4: 0 });
  });
});
