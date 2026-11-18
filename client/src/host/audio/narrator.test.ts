import { describe, it, expect } from 'vitest';
import { narrationFor, splitIntoSentences, pickBestItalianVoice } from './narrator';
import type { PublicDilemma, StoriaView } from '../../shared/events';

// A minimal stand-in for SpeechSynthesisVoice (only the fields the picker reads).
function voice(name: string, lang: string, localService = false): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

const storia: StoriaView = {
  storyId: 'prova',
  title: "L'Ultima Orbita",
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

const sampleDilemma: PublicDilemma = {
  id: 'd1',
  text: 'Cosa dici nel messaggio?',
  optionA: 'La verità nuda',
  optionB: 'Una versione rassicurante',
};

describe('narrationFor', () => {
  it('STORY_INTRO legge titolo + protagonista + premessa', () => {
    const line = narrationFor('STORY_INTRO', storia);
    expect(line).toContain("L'Ultima Orbita");
    expect(line).toContain('Sara');
    expect(line).toContain('La stazione gira nel vuoto.');
  });

  it('SCENE_INTRO legge la narrazione della scena', () => {
    expect(narrationFor('SCENE_INTRO', storia)).toBe('Il Consiglio ti chiede un messaggio.');
  });

  it('DILEMMA_REVEAL e VOTE_1 in storia leggono il dilemma e le scelte direttamente', () => {
    const reveal = narrationFor('DILEMMA_REVEAL', storia, sampleDilemma);
    expect(reveal).toBe('Cosa dici nel messaggio? La verità nuda, oppure Una versione rassicurante.');

    const vote1 = narrationFor('VOTE_1', storia, sampleDilemma);
    expect(vote1).toBe('Cosa dici nel messaggio? La verità nuda, oppure Una versione rassicurante.');
  });

  it('SCENE_CONSEQUENCE senza decisione legge la conseguenza pura', () => {
    expect(narrationFor('SCENE_CONSEQUENCE', { ...storia, consequence: 'Tutti tacciono.' })).toBe('Tutti tacciono.');
  });

  it('SCENE_CONSEQUENCE con decisione A annuncia la scelta e la conseguenza', () => {
    const line = narrationFor(
      'SCENE_CONSEQUENCE',
      { ...storia, decision: 'A', consequence: 'La stazione trattiene il fiato.' },
      sampleDilemma,
    );
    expect(line).toBe('Il gruppo ha scelto: La verità nuda. La stazione trattiene il fiato.');
  });

  it('SCENE_CONSEQUENCE con decisione B annuncia la scelta e la conseguenza', () => {
    const line = narrationFor(
      'SCENE_CONSEQUENCE',
      { ...storia, decision: 'B', consequence: 'Il mattino scorre sereno.' },
      sampleDilemma,
    );
    expect(line).toBe('Il gruppo ha scelto: Una versione rassicurante. Il mattino scorre sereno.');
  });

  it('STORY_EPILOGUE legge l\'epilogo', () => {
    expect(narrationFor('STORY_EPILOGUE', { ...storia, epilogo: 'Sopravvivete.' })).toBe('Sopravvivete.');
  });

  it('DILEMMA_REVEAL in modalità classica legge il dilemma e le scelte direttamente', () => {
    const line = narrationFor('DILEMMA_REVEAL', null, sampleDilemma);
    expect(line).toBe('Cosa dici nel messaggio? La verità nuda, oppure Una versione rassicurante.');
  });

  it('rispetta l\'opzione readClassicDilemmas: false', () => {
    const line = narrationFor('DILEMMA_REVEAL', null, sampleDilemma, { readClassicDilemmas: false });
    expect(line).toBeNull();
  });

  it('le fasi non narrative non producono testo', () => {
    expect(narrationFor('VOTE_1', storia)).toBeNull();
    expect(narrationFor('DEFENSE', storia)).toBeNull();
    expect(narrationFor('FINAL_AWARDS', storia)).toBeNull();
  });

  it('senza storia né dilemma non produce testo', () => {
    expect(narrationFor('SCENE_INTRO', null)).toBeNull();
    expect(narrationFor('DILEMMA_REVEAL', null)).toBeNull();
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

  it('preferisce voci Natural / Neural rispetto a voci standard', () => {
    const picked = pickBestItalianVoice([
      voice('Alice', 'it-IT'),
      voice('Microsoft Elsa Online (Natural) - Italian (Italy)', 'it-IT'),
    ]);
    expect(picked?.name).toContain('Natural');
  });
});
