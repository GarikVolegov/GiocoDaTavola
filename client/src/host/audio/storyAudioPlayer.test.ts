import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoryAudioUrl,
  epilogueIndexForDecisions,
  stopStoryAudio,
} from './storyAudioPlayer';
import type { PublicDilemma, StoriaView } from '../../shared/events';

const sampleStoria: StoriaView = {
  storyId: 'ultima-orbita',
  title: "L'Ultima Orbita",
  protagonist: 'Sara',
  emoji: '🛰️',
  premessa: 'La stazione gira nel vuoto.',
  actTitle: 'Atto I',
  sceneNarration: 'Il Consiglio ti chiede un messaggio.',
  sceneIndex: 0,
  totalScenes: 12,
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

describe('storyAudioPlayer', () => {
  beforeEach(() => {
    stopStoryAudio();
  });

  describe('epilogueIndexForDecisions', () => {
    it('calcola correttamente l\'indice dell\'epilogo', () => {
      expect(epilogueIndexForDecisions(0)).toBe(0);
      expect(epilogueIndexForDecisions(1)).toBe(0);
      expect(epilogueIndexForDecisions(2)).toBe(1);
      expect(epilogueIndexForDecisions(3)).toBe(2);
      expect(epilogueIndexForDecisions(5)).toBe(2);
    });
  });

  describe('getStoryAudioUrl', () => {
    it('risolve intro per STORY_INTRO', () => {
      const url = getStoryAudioUrl('STORY_INTRO', sampleStoria);
      expect(url).toBe('/audio/stories/ultima-orbita/intro.mp3');
    });

    it('risolve scene_{i} per SCENE_INTRO', () => {
      const url = getStoryAudioUrl('SCENE_INTRO', { ...sampleStoria, sceneIndex: 2 });
      expect(url).toBe('/audio/stories/ultima-orbita/scene_2.mp3');
    });

    it('risolve bivio_{i} per DILEMMA_REVEAL e VOTE_1', () => {
      // In DILEMMA_REVEAL/VOTE_1, sceneIndex is 1-based (dilemmaIndex = 1 corresponds to scene 0)
      const revealUrl = getStoryAudioUrl('DILEMMA_REVEAL', { ...sampleStoria, sceneIndex: 1 }, sampleDilemma);
      expect(revealUrl).toBe('/audio/stories/ultima-orbita/bivio_0.mp3');

      const vote1Url = getStoryAudioUrl('VOTE_1', { ...sampleStoria, sceneIndex: 3 }, sampleDilemma);
      expect(vote1Url).toBe('/audio/stories/ultima-orbita/bivio_2.mp3');
    });

    it('risolve consequence_{i}_{decision} per SCENE_CONSEQUENCE', () => {
      const urlA = getStoryAudioUrl('SCENE_CONSEQUENCE', { ...sampleStoria, sceneIndex: 1, decision: 'A' }, sampleDilemma);
      expect(urlA).toBe('/audio/stories/ultima-orbita/consequence_0_A.mp3');

      const urlB = getStoryAudioUrl('SCENE_CONSEQUENCE', { ...sampleStoria, sceneIndex: 2, decision: 'B' }, sampleDilemma);
      expect(urlB).toBe('/audio/stories/ultima-orbita/consequence_1_B.mp3');
    });

    it('risolve epilogue_{idx} per STORY_EPILOGUE', () => {
      const url0 = getStoryAudioUrl('STORY_EPILOGUE', { ...sampleStoria, decisionsA: 1 });
      expect(url0).toBe('/audio/stories/ultima-orbita/epilogue_0.mp3');

      const url2 = getStoryAudioUrl('STORY_EPILOGUE', { ...sampleStoria, decisionsA: 4 });
      expect(url2).toBe('/audio/stories/ultima-orbita/epilogue_2.mp3');
    });

    it('genera url endpoint TTS per dilemmi classici', () => {
      const url = getStoryAudioUrl('DILEMMA_REVEAL', null, sampleDilemma);
      expect(url).toContain('/api/audio/tts?text=');
      expect(url).toContain(encodeURIComponent('Cosa dici nel messaggio?'));
    });

    it('restituisce null per fasi non audio', () => {
      expect(getStoryAudioUrl('DEFENSE', sampleStoria)).toBeNull();
      expect(getStoryAudioUrl('FINAL_AWARDS', sampleStoria)).toBeNull();
    });
  });
});
