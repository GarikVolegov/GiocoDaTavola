import { describe, it, expect } from 'vitest';
import { narrationFor, splitIntoSentences, pickBestItalianVoice } from './narrator';
import type { StoriaView } from '../../shared/events';

// A minimal stand-in for SpeechSynthesisVoice (only the fields the picker reads).
function voice(name: string, lang: string, localService = false): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

const storia: StoriaView = {
  storyId: 'prova',
  title: 'L\'Ultima Orbita',
  protagonist: 'Sara',
  emoji: '🛰️',
  premessa: 'La stazione gira nel vuoto.',
  actTitle: 'Atto I',
  sceneNarration: 'Il Consiglio ti chiede un messaggio.',
  sceneIndex: 0,
  totalScenes: 2,
  decision: null,
  consequence: null,
  epilogo: null,
  decisionsA: 0,
};

describe('narrationFor', () => {
  it('STORY_INTRO legge titolo + premessa', () => {
    const line = narrationFor('STORY_INTRO', storia);
    expect(line).toContain('L\'Ultima Orbita');
    expect(line).toContain('La stazione gira nel vuoto.');
  });

  it('SCENE_INTRO legge la narrazione della scena', () => {
    expect(narrationFor('SCENE_INTRO', storia)).toBe('Il Consiglio ti chiede un messaggio.');
  });

  it('SCENE_CONSEQUENCE legge la conseguenza', () => {
    expect(narrationFor('SCENE_CONSEQUENCE', { ...storia, consequence: 'Tutti tacciono.' })).toBe('Tutti tacciono.');
  });

  it('STORY_EPILOGUE legge l\'epilogo', () => {
    expect(narrationFor('STORY_EPILOGUE', { ...storia, epilogo: 'Sopravvivete.' })).toBe('Sopravvivete.');
  });

  it('le fasi non narrative non producono testo', () => {
    expect(narrationFor('VOTE_1', storia)).toBeNull();
    expect(narrationFor('DEFENSE', storia)).toBeNull();
    expect(narrationFor('FINAL_AWARDS', storia)).toBeNull();
  });

  it('senza storia non produce testo', () => {
    expect(narrationFor('SCENE_INTRO', null)).toBeNull();
  });

  it('un testo assente per la fase non produce nulla', () => {
    expect(narrationFor('SCENE_CONSEQUENCE', { ...storia, consequence: null })).toBeNull();
  });
});

describe('splitIntoSentences', () => {
  it('spezza la prosa in frasi rifilate, tenendo i terminatori', () => {
    expect(
      splitIntoSentences('Era una notte buia. Poi, un lampo! Che fare?'),
    ).toEqual(['Era una notte buia.', 'Poi, un lampo!', 'Che fare?']);
  });

  it('tiene i puntini di sospensione dentro la frase', () => {
    expect(splitIntoSentences('Forse... niente.')).toEqual(['Forse...', 'niente.']);
  });

  it('un testo senza terminatore resta un unico blocco', () => {
    expect(splitIntoSentences('Nessuna punteggiatura qui')).toEqual(['Nessuna punteggiatura qui']);
  });

  it('niente blocchi per input vuoto / spazi', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   \n  ')).toEqual([]);
  });
});

describe('pickBestItalianVoice', () => {
  it('restituisce null senza voci', () => {
    expect(pickBestItalianVoice([])).toBeNull();
  });

  it('restituisce null se non c\'è nessuna voce italiana', () => {
    expect(pickBestItalianVoice([voice('Daniel', 'en-GB'), voice('Samantha', 'en-US')])).toBeNull();
  });

  it('preferisce una voce italiana a una non italiana', () => {
    const picked = pickBestItalianVoice([voice('Daniel', 'en-GB'), voice('Luca', 'it-IT')]);
    expect(picked?.name).toBe('Luca');
  });

  it('preferisce una voce italiana di qualità (Siri/enhanced) a una base', () => {
    const picked = pickBestItalianVoice([
      voice('Alice', 'it-IT'),
      voice('Siri Voice 2 (Italian (Italy))', 'it-IT'),
    ]);
    expect(picked?.name).toContain('Siri');
  });
});
