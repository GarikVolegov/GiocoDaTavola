import { describe, it, expect } from 'vitest';
import {
  dilemmasForPercorso,
  dilemmasForPercorsoTappa,
  ensureSpunti,
  filterByFamiliarita,
  filterByMood,
  loadDilemmas,
  type Complessita,
  type CorsiaTono,
  type DinamicaDilemma,
  type DilemmaFamiliarita,
  type PolarizzazioneDilemma,
  type Tappa,
} from '../deck';
import { PERCORSI_CATALOG } from '../percorso';

const VALID_REGISTERS = new Set(['vita', 'business', 'carriera']);
const VALID_COMPLESSITA = new Set<Complessita>(['sorbetto', 'alto', 'max', 'power']);
const VALID_TONO = new Set<CorsiaTono>(['risate', 'direzione', 'serio']);
const VALID_DINAMICA = new Set<DinamicaDilemma>([
  'identita',
  'relazione',
  'etica',
  'azione',
  'assurdo',
  'priorita',
]);
const VALID_POLARIZZAZIONE = new Set<PolarizzazioneDilemma>(['alta', 'media', 'bassa']);
const VALID_FAMILIARITA = new Set<DilemmaFamiliarita>(['vecchi_amici', 'nuove_conoscenze', 'tutti']);

describe('dilemmas.json dataset integrity', () => {
  const all = loadDilemmas();

  it('has no duplicate ids or duplicate texts', () => {
    const ids = new Set(all.map((d) => d.id));
    const texts = new Set(all.map((d) => d.text.trim().toLowerCase()));
    expect(ids.size).toBe(all.length);
    expect(texts.size).toBe(all.length);
  });

  it('has valid enums and non-empty text, options, and talking points on every dilemma', () => {
    for (const d of all) {
      expect(d.id.trim().length).toBeGreaterThan(0);
      expect(d.text.trim().length).toBeGreaterThan(5);
      expect(d.optionA.trim().length).toBeGreaterThan(0);
      expect(d.optionB.trim().length).toBeGreaterThan(0);
      expect(VALID_REGISTERS.has(d.register)).toBe(true);
      expect(d.complessita && VALID_COMPLESSITA.has(d.complessita)).toBe(true);
      expect(d.tono && VALID_TONO.has(d.tono)).toBe(true);
      expect(d.dinamica && VALID_DINAMICA.has(d.dinamica)).toBe(true);
      expect(d.polarizzazione && VALID_POLARIZZAZIONE.has(d.polarizzazione)).toBe(true);
      expect(d.familiarita && VALID_FAMILIARITA.has(d.familiarita)).toBe(true);
      expect(Array.isArray(d.temi) && d.temi.length).toBeGreaterThan(0);
      expect(Array.isArray(d.spuntiA) && d.spuntiA.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(d.spuntiB) && d.spuntiB.length).toBeGreaterThanOrEqual(2);
      expect(d.lezioneReale && d.lezioneReale.trim().length).toBeGreaterThan(10);
      expect(d.domandaRilancio && d.domandaRilancio.trim().length).toBeGreaterThan(10);
    }
  });

  it('provides sufficient coverage for every percorso and tappa without delicate leaks', () => {
    for (const meta of PERCORSI_CATALOG) {
      const pool = dilemmasForPercorso(all, meta.id, meta.corsia);
      for (const tappa of [1, 2, 3, 4] as Tappa[]) {
        const stepPool = dilemmasForPercorsoTappa(pool, tappa);
        expect(stepPool.length).toBeGreaterThanOrEqual(10);
      }
    }

    const safePool = filterByMood(all, 'mista', false);
    expect(safePool.every((d) => !d.delicato)).toBe(true);
  });

  it('provides >= 10 dilemmas per percorso/tappa across every familiarita setting', () => {
    for (const meta of PERCORSI_CATALOG) {
      const pool = dilemmasForPercorso(all, meta.id, meta.corsia);
      for (const fam of ['vecchi_amici', 'nuove_conoscenze', 'misto'] as const) {
        for (const tappa of [1, 2, 3, 4] as Tappa[]) {
          const stepPool = filterByFamiliarita(dilemmasForPercorsoTappa(pool, tappa), fam);
          expect(
            stepPool.length,
            `${meta.id} tappa ${tappa} (${fam}) should have >= 10 dilemmas`,
          ).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });

  it('ensureSpunti always returns at least 2 non-empty talking points per side', () => {
    const out = ensureSpunti({
      optionA: 'Restare',
      optionB: 'Partire',
      spuntiA: [],
      spuntiB: ['Solo uno'],
    });
    expect(out.spuntiA.length).toBeGreaterThanOrEqual(2);
    expect(out.spuntiB.length).toBeGreaterThanOrEqual(2);
    expect(out.spuntiA.every((s) => s.trim().length > 0)).toBe(true);
    expect(out.spuntiB.every((s) => s.trim().length > 0)).toBe(true);
  });
});
