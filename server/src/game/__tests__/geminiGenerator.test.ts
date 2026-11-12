import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT,
  getCuratedCards,
  generatePartyCards,
  loadCuratedDecks,
  type FlashCard,
  type InfiltratoCard,
  type CoppieCard,
  type AssurdoCard,
} from '../geminiGenerator';

describe('geminiGenerator', () => {
  it('contains the mandatory party game system prompt', () => {
    expect(SYSTEM_PROMPT).toContain("Sei l'autore creativo di un party game virale");
    expect(SYSTEM_PROMPT).toContain('ZERO FILOSOFIA O ASTRAZIONE');
    expect(SYSTEM_PROMPT).toContain('BREVITÀ ESTREMA');
    expect(SYSTEM_PROMPT).toContain('LINGUAGGIO REALE E GIOVANILE (NON CRINGE)');
    expect(SYSTEM_PROMPT).toContain('POLARIZZAZIONE IMMEDIATA');
    expect(SYSTEM_PROMPT).toContain('FORMATO JSON RIGOROSO');
  });

  it('loads curated decks for all 4 party modes from party_decks.json', () => {
    const decks = loadCuratedDecks();
    expect(decks.flash.length).toBeGreaterThanOrEqual(20);
    expect(decks.infiltrato.length).toBeGreaterThanOrEqual(15);
    expect(decks.coppie.complicita.length).toBeGreaterThanOrEqual(10);
    expect(decks.coppie.piccante.length).toBeGreaterThanOrEqual(10);
    expect(decks.assurdo.length).toBeGreaterThanOrEqual(15);
  });

  it('getCuratedCards returns valid flash cards with short texts', () => {
    const cards = getCuratedCards('flash', { count: 10 }) as FlashCard[];
    expect(cards).toHaveLength(10);
    for (const c of cards) {
      expect(c.text.trim().length).toBeGreaterThan(0);
      expect(c.optionA.trim().length).toBeGreaterThan(0);
      expect(c.optionB.trim().length).toBeGreaterThan(0);
      const words = c.text.trim().split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(20);
    }
  });

  it('getCuratedCards returns valid infiltrato pairs with group and impostor questions', () => {
    const cards = getCuratedCards('infiltrato', { count: 5 }) as InfiltratoCard[];
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.groupQuestion).toBeDefined();
      expect(c.impostorQuestion).toBeDefined();
      expect(c.groupQuestion).not.toBe(c.impostorQuestion);
    }
  });

  it('getCuratedCards supports coppie with complicita and piccante intensity', () => {
    const compCards = getCuratedCards('coppie', { count: 5, intensity: 'complicita' }) as CoppieCard[];
    const piccCards = getCuratedCards('coppie', { count: 5, intensity: 'piccante' }) as CoppieCard[];
    expect(compCards).toHaveLength(5);
    expect(piccCards).toHaveLength(5);
    expect(compCards.every((c) => c.intensity === 'complicita')).toBe(true);
    expect(piccCards.every((c) => c.intensity === 'piccante')).toBe(true);
  });

  it('getCuratedCards supports assurdo mode with gogna and dignita cards', () => {
    const cards = getCuratedCards('assurdo', { count: 10 }) as AssurdoCard[];
    expect(cards).toHaveLength(10);
    const types = cards.map((c) => c.cardType);
    expect(types).toContain('gogna');
    expect(types).toContain('dignita');
  });

  it('generatePartyCards falls back gracefully to curated cards when no API key is present', async () => {
    const cards = (await generatePartyCards('flash', { count: 4 })) as FlashCard[];
    expect(cards).toHaveLength(4);
    expect(cards[0].text).toBeDefined();
  });
});
