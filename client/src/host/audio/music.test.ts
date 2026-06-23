// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startMusic, stopMusic } from './music';

// A throwaway fake Web Audio graph: we only care how many oscillators the scheduler
// creates (= notes actually queued). engine.ts caches one context, so we hand back a
// single shared fake.
let oscCreated = 0;
let maxStart = 0; // furthest-ahead note start time queued (= buffer depth)
let now = 0;

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
});

const fakeCtx = {
  state: 'running' as const,
  get currentTime() {
    return now;
  },
  destination: { connect: vi.fn(), disconnect: vi.fn() },
  resume: vi.fn(() => Promise.resolve()),
  createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }),
  createOscillator: () => {
    oscCreated += 1;
    return {
      type: 'sine',
      frequency: param(),
      connect: vi.fn(),
      start: (when: number) => {
        if (when > maxStart) maxStart = when;
      },
      stop: vi.fn(),
    };
  },
  createAnalyser: () => ({ fftSize: 0, connect: vi.fn(), getFloatTimeDomainData: vi.fn() }),
};

beforeEach(() => {
  oscCreated = 0;
  maxStart = 0;
  now = 0;
  vi.useFakeTimers();
  // Must be constructable (engine does `new Ctor()`), so a plain function, not an arrow.
  (window as unknown as { AudioContext: unknown }).AudioContext = function FakeAudioContext() {
    return fakeCtx;
  };
});

afterEach(() => {
  stopMusic();
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('music start/stop lifecycle', () => {
  it('schedules notes when started (LOBBY)', () => {
    startMusic();
    expect(oscCreated).toBeGreaterThan(0);
  });

  it('restarts after being stopped — the core gameplay phase cycling', () => {
    startMusic(); // LOBBY / a waiting phase
    expect(oscCreated).toBeGreaterThan(0);

    stopMusic(); // a non-waiting reveal phase
    vi.advanceTimersByTime(400); // let the disconnect timeout fire

    oscCreated = 0;
    now = 12; // time has moved on
    startMusic(); // the next waiting phase (VOTE_1, PREDICT, …)
    expect(oscCreated).toBeGreaterThan(0); // music MUST come back
  });

  it('queues several seconds of audio ahead so a throttled timer cannot starve it', () => {
    now = 100;
    startMusic();
    // Must buffer well past the ~1s background-tab timer throttle.
    expect(maxStart - now).toBeGreaterThan(3);
  });

  it('resyncs instead of dumping a backlog after the tab was throttled/hidden', () => {
    startMusic();
    oscCreated = 0;
    // Simulate a long hidden stretch: the audio clock advanced 30s but the throttled
    // interval did not fire. The next tick must NOT schedule ~30s of past notes at once.
    now = 30;
    vi.advanceTimersByTime(150); // fire the scheduler once
    expect(oscCreated).toBeGreaterThan(0); // music resumes
    expect(oscCreated).toBeLessThan(40); // but only a small look-ahead, not a backlog
  });
});
