// The background "musichetta": a look-ahead scheduler (standard Web Audio pattern) that
// reads the pure loop from sequence.ts and plays it quietly under the host screen. A
// setInterval ticks every LOOKAHEAD_MS and queues any notes due in the next window with
// sample-accurate timing. Drops to a softer mix while someone is speaking.

import { getCtx, getMaster } from './engine';
import { noteAt, LOOP_STEPS, SECONDS_PER_BEAT, type NoteEvent } from './sequence';

let musicGain: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextNoteTime = 0;
let running = false;
let intensity: MusicIntensity = 'full';

export type MusicIntensity = 'full' | 'soft';

const LOOKAHEAD_MS = 100; // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.25; // seconds of audio to queue in advance
// Overall loudness of the bed; "soft" ducks under a speaker without going silent.
const BED_GAIN: Record<MusicIntensity, number> = { full: 0.1, soft: 0.045 };

function scheduleNote(note: NoteEvent, when: number): void {
  const ctx = getCtx();
  if (!ctx || !musicGain) return;
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
  g.connect(musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function scheduler(): void {
  const ctx = getCtx();
  if (!ctx) return;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    for (const note of noteAt(step)) scheduleNote(note, nextNoteTime);
    nextNoteTime += SECONDS_PER_BEAT;
    step = (step + 1) % LOOP_STEPS;
  }
}

export function startMusic(): void {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master || running) return;
  void ctx.resume();
  musicGain = ctx.createGain();
  musicGain.gain.value = BED_GAIN[intensity];
  musicGain.connect(master);
  step = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  running = true;
  scheduler();
  timer = setInterval(scheduler, LOOKAHEAD_MS);
}

export function stopMusic(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const ctx = getCtx();
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    const node = musicGain;
    setTimeout(() => node.disconnect(), 300);
  }
  musicGain = null;
  running = false;
}

/** Duck the bed under a speaker ('soft') or bring it back ('full'). */
export function setMusicIntensity(next: MusicIntensity): void {
  intensity = next;
  const ctx = getCtx();
  if (running && ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(BED_GAIN[next], ctx.currentTime, 0.3);
  }
}
