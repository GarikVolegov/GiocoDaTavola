// The background "musichetta". It loops on the AUDIO THREAD: we render one pass of the
// Am–F–C–G loop (from sequence.ts) into an AudioBuffer once, then play it with loop=true.
//
// Why not a setInterval look-ahead scheduler? /host is usually NOT the focused tab while
// people play (they're on their phones / the player view) and is often an embedded preview
// (e.g. VS Code's browser). Browsers throttle — or outright freeze — JS timers in
// background/hidden views, which would stall a timer-driven scheduler and kill the music
// (one-shot SFX still fire on events, so you'd hear "random" sounds but no music — exactly
// the reported bug). A looping AudioBufferSourceNode keeps playing regardless of JS-timer
// state, as long as the AudioContext is running. Ducking stays real-time via the bus gain.

import { getCtx, getMaster } from './engine';
import { noteAt, LOOP_STEPS, SECONDS_PER_BEAT, type NoteEvent } from './sequence';

export type MusicIntensity = 'full' | 'soft';

let musicGain: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let buffer: AudioBuffer | null = null;
let rendering = false;
let running = false; // "should be playing" — survives the async render
let intensity: MusicIntensity = 'full';

const LOOP_SECONDS = LOOP_STEPS * SECONDS_PER_BEAT;
// Overall loudness of the bed; "soft" ducks under a speaker without going silent.
// Tuned so the musichetta is clearly audible as background music (≈ -15 dBFS peak).
const BED_GAIN: Record<MusicIntensity, number> = { full: 0.34, soft: 0.16 };

function offlineCtor(): typeof OfflineAudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext ??
    null
  );
}

// Render one loop of the sequence into an AudioBuffer (offline, once — then cached).
async function renderLoop(sampleRate: number): Promise<AudioBuffer | null> {
  const Ctor = offlineCtor();
  if (!Ctor) return null;
  const length = Math.ceil(LOOP_SECONDS * sampleRate);
  const off = new Ctor(1, length, sampleRate);
  for (let step = 0; step < LOOP_STEPS; step++) {
    const when = step * SECONDS_PER_BEAT;
    for (const note of noteAt(step)) scheduleNote(off, off.destination, note, when);
  }
  return off.startRendering();
}

function scheduleNote(ctx: BaseAudioContext, dest: AudioNode, note: NoteEvent, when: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'triangle'; // soft, flute-like — gentle on the ears
  osc.frequency.value = note.freq;
  const g = ctx.createGain();
  const dur = note.durationBeats * SECONDS_PER_BEAT;
  // Quick attack, smooth exponential release — no clicks.
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(note.gain, when + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// Start the looping source — only once the buffer is ready and we still want to play.
function beginPlayback(): void {
  const ctx = getCtx();
  if (!running || !buffer || !ctx || !musicGain || source) return;
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(musicGain);
  source.start();
}

export function startMusic(): void {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master || running) return;
  void ctx.resume();
  running = true;
  musicGain = ctx.createGain();
  musicGain.gain.value = BED_GAIN[intensity];
  musicGain.connect(master);

  if (buffer) {
    beginPlayback();
    return;
  }
  if (!rendering) {
    rendering = true;
    renderLoop(ctx.sampleRate)
      .then((buf) => {
        buffer = buf;
        rendering = false;
        beginPlayback(); // reads current state — plays only if still running
      })
      .catch(() => {
        rendering = false;
      });
  }
  // If a render is already in flight (from a previous start), its .then will call
  // beginPlayback against the current state, so this start is covered too.
}

export function stopMusic(): void {
  running = false;
  if (source) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    source.disconnect();
    source = null;
  }
  const ctx = getCtx();
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    const node = musicGain;
    setTimeout(() => node.disconnect(), 300);
  }
  musicGain = null;
}

/** Duck the bed under a speaker ('soft') or bring it back ('full') — real-time, on the bus. */
export function setMusicIntensity(next: MusicIntensity): void {
  intensity = next;
  const ctx = getCtx();
  if (running && ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(BED_GAIN[next], ctx.currentTime, 0.3);
  }
}
