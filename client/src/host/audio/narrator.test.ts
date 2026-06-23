import { describe, it, expect } from 'vitest';
import { narrationFor } from './narrator';
import type { StoriaView } from '../../shared/events';

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
