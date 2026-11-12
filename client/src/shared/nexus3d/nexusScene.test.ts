// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isWebGLAvailable, NexusScene } from './nexusScene';

describe('isWebGLAvailable', () => {
  it('returns a boolean safely', () => {
    const result = isWebGLAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('NexusScene', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates and destroys without throwing in non-WebGL environments', () => {
    const scene = new NexusScene(canvas, { variant: 'host', phase: 'LOBBY', lean: 50 });
    expect(() => {
      scene.updateState({ phase: 'DILEMMA_REVEAL', lean: 75 });
      scene.triggerShockwave();
      scene.destroy();
    }).not.toThrow();
  });

  it('updates state and handles phase transitions cleanly', () => {
    const scene = new NexusScene(canvas, { variant: 'player', phase: 'VOTE_1', lean: 50 });
    scene.updateState({
      phase: 'SPLIT_REVEAL',
      lean: 25,
      isRibaltone: true,
      celebrate: true,
    });
    scene.destroy();
  });
});
