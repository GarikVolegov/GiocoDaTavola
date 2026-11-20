import { describe, it, expect } from 'vitest';
import {
  loadSoloDecksRaw,
  getSoloDilemmas,
  getSoloQuestionari,
  getSoloPartyCards,
  isSoloFriendlyText,
  enforceTwoOptionsForSolo,
} from '../soloDecks';
import type { PreferirestiCard } from '../geminiGenerator';

describe('Solo Decks integrity & 2-choice invariant', () => {
  it('loads all solo decks with sufficient counts and globally unique ids', () => {
    const raw = loadSoloDecksRaw();
    const dilemmas = getSoloDilemmas();
    const questionari = getSoloQuestionari();
    const flash = getSoloPartyCards('flash');
    const preferiresti = getSoloPartyCards('preferiresti');
    const assurdo = getSoloPartyCards('assurdo');

    expect(raw.dilemmi.length).toBeGreaterThanOrEqual(32);
    expect(dilemmas.length).toBe(raw.dilemmi.length);
    expect(raw.flash.length).toBeGreaterThanOrEqual(24);
    expect(flash.length).toBe(raw.flash.length);
    expect(raw.preferiresti.length).toBeGreaterThanOrEqual(24);
    expect(preferiresti.length).toBe(raw.preferiresti.length);
    expect(raw.assurdo.length).toBeGreaterThanOrEqual(20);
    expect(assurdo.length).toBe(raw.assurdo.length);
    expect(questionari.length).toBeGreaterThanOrEqual(24);

    const allIds = [
      ...dilemmas.map((d) => d.id),
      ...flash.map((c) => c.id),
      ...preferiresti.map((c) => c.id),
      ...assurdo.map((c) => c.id),
      ...questionari.map((q) => q.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('guarantees strictly 2 options on every solo preferiresti and dignita card', () => {
    const preferiresti = getSoloPartyCards('preferiresti') as PreferirestiCard[];
    for (const c of preferiresti) {
      expect(c.options).toHaveLength(2);
      expect(c.optionA).toBe(c.options[0]);
      expect(c.optionB).toBe(c.options[1]);
      expect(c.optionC).toBeUndefined();
      expect(c.optionD).toBeUndefined();
    }

    const assurdo = getSoloPartyCards('assurdo');
    for (const c of assurdo) {
      expect(c.mode).toBe('assurdo');
      if (c.mode === 'assurdo') {
        expect(c.cardType).toBe('dignita');
        expect(c.optionA.trim().length).toBeGreaterThan(0);
        expect(c.optionB.trim().length).toBeGreaterThan(0);
      }
    }

    const sampleFour: PreferirestiCard = {
      id: 'tmp4',
      mode: 'preferiresti',
      prompt: 'Test 4',
      options: ['Uno', 'Due', 'Tre', 'Quattro'],
    };
    const trimmed = enforceTwoOptionsForSolo(sampleFour);
    expect(trimmed.options).toEqual(['Uno', 'Due']);
    expect(trimmed.optionA).toBe('Uno');
    expect(trimmed.optionB).toBe('Due');
    expect(trimmed.optionC).toBeUndefined();
    expect(trimmed.optionD).toBeUndefined();
  });

  it('contains only personal 2nd-person solo prompts without group/table/drinking references', () => {
    for (const d of getSoloDilemmas()) {
      expect(isSoloFriendlyText(d.text), d.id).toBe(true);
      expect(isSoloFriendlyText(d.optionA), d.id).toBe(true);
      expect(isSoloFriendlyText(d.optionB), d.id).toBe(true);
    }
    for (const q of getSoloQuestionari()) {
      expect(isSoloFriendlyText(q.prompt), q.id).toBe(true);
      expect(isSoloFriendlyText(q.optionA), q.id).toBe(true);
      expect(isSoloFriendlyText(q.optionB), q.id).toBe(true);
    }
    for (const f of getSoloPartyCards('flash')) {
      if (f.mode === 'flash') {
        expect(isSoloFriendlyText(f.text), f.id).toBe(true);
        expect(isSoloFriendlyText(f.optionA), f.id).toBe(true);
        expect(isSoloFriendlyText(f.optionB), f.id).toBe(true);
      }
    }
    for (const p of getSoloPartyCards('preferiresti')) {
      if (p.mode === 'preferiresti') {
        expect(isSoloFriendlyText(p.prompt), p.id).toBe(true);
        for (const opt of p.options) expect(isSoloFriendlyText(opt), p.id).toBe(true);
      }
    }
    for (const a of getSoloPartyCards('assurdo')) {
      if (a.mode === 'assurdo') {
        expect(isSoloFriendlyText(a.prompt), a.id).toBe(true);
      }
    }
  });
});
