// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startMusic, stopMusic } from './music';
import { LOOP_STEPS, SECONDS_PER_BEAT } from './sequence';

// The musichetta now loops on the audio thread (an AudioBufferSourceNode with loop=true),
// so it survives background-tab JS-timer throttling/freezing. These fakes let us assert
// that a looping source is created and torn down — no real Web Audio needed.
let sources: Array<{ buffer: unknown; loop: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
let offlineOscillators = 0;

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
});

const FAKE_BUFFER = { duration: LOOP_STEPS * SECONDS_PER_BEAT };

const realCtx = {
  state: 'running' as const,
  currentTime: 0,
  sampleRate: 44100,
  destination: { connect: vi.fn(), disconnect: vi.fn() },
  resume: vi.fn(() => Promise.resolve()),
  createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }),
  createOscillator: () => ({ type: 'sine', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
  createBufferSource: () => {
    const s = { buffer: null as unknown, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    sources.push(s);
    return s;
  },
};

function FakeOffline() {
  return {
    destination: { connect: vi.fn() },
    createOscillator: () => {
      offlineOscillators += 1;
      return { type: 'sine', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    },
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    startRendering: () => Promise.resolve(FAKE_BUFFER),
  };
}

beforeEach(() => {
  sources = [];
  offlineOscillators = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = function FakeAudioContext() {
    return realCtx;
  };
  (window as unknown as { OfflineAudioContext: unknown }).OfflineAudioContext = function FakeOfflineCtx() {
    return FakeOffline();
  };
});

afterEach(() => stopMusic());

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('musichetta (looping buffer — throttle-proof)', () => {
  it('renders the loop and plays it as a looping buffer source', async () => {
    startMusic();
    await flush();
    expect(offlineOscillators).toBeGreaterThan(0); // the loop got rendered
    expect(sources.length).toBe(1);
    expect(sources[0].loop).toBe(true); // loops on the audio thread, no JS timer
    expect(sources[0].start).toHaveBeenCalled();
  });

  it('stops the source on stopMusic', async () => {
    startMusic();
    await flush();
    const s = sources[0];
    stopMusic();
    expect(s.stop).toHaveBeenCalled();
  });

  it('restarts after being stopped (game phase cycling)', async () => {
    startMusic();
    await flush();
    stopMusic();
    startMusic();
    await flush();
    expect(sources.length).toBe(2);
    expect(sources[1].loop).toBe(true);
    expect(sources[1].start).toHaveBeenCalled();
  });
});
