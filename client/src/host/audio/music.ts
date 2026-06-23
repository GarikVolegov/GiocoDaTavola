// The background "musichetta": a look-ahead scheduler (standard Web Audio pattern) that
// reads the pure loop from sequence.ts and plays it quietly under the host screen. A
// setInterval ticks every LOOKAHEAD_MS and queues any notes due in the next window with
// sample-accurate timing. Drops to a softer mix while someone is speaking.
//
// CRITICAL: /host is often NOT the focused tab during play (the leader is on their phone /
// the player view), and browsers throttle setInterval to ~1/s in background tabs — a tiny
// look-ahead leaves the music dead silent. So we queue several SECONDS ahead (audio plays
// even while the JS timer is throttled), resync if we ever fall behind, and re-prime the
// moment the tab returns to the foreground.

import { getCtx, getMaster } from './engine';
import { noteAt, LOOP_STEPS, SECONDS_PER_BEAT, type NoteEvent } from './sequence';

let musicGain: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextNoteTime = 0;
let running = false;
let intensity: MusicIntensity = 'full';

export type MusicIntensity = 'full' | 'soft';

const LOOKAHEAD_MS = 100; // how often the scheduler wakes (when not throttled)
// Seconds of audio to queue in advance. Generous on purpose: it must exceed the ~1s
// background-tab timer throttle so the music never runs dry while /host is unfocused.
const SCHEDULE_AHEAD = 5;
// Overall loudness of the bed; "soft" ducks under a speaker without going silent.
// Tuned so the musichetta is clearly audible as background music (not a faint hum) —
// see /tmp audio probe: full ≈ -15 dBFS peak.
const BED_GAIN: Record<MusicIntensity, number> = { full: 0.34, soft: 0.16 };

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
  // If the tab was throttled/hidden, the clock jumped ahead of us. Don't dump a backlog
  // of past-due notes (they'd pile up at once) — skip forward to "now" and carry on.
  if (nextNoteTime < ctx.currentTime) {
    nextNoteTime = ctx.currentTime + 0.05;
  }
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    for (const note of noteAt(step)) scheduleNote(note, nextNoteTime);
    nextNoteTime += SECONDS_PER_BEAT;
    step = (step + 1) % LOOP_STEPS;
  }
}

// On returning to the foreground, resume the (possibly auto-suspended) context and top up
// the queue immediately, so any gap from a long hide closes at once instead of next tick.
function onVisibility(): void {
  if (!running || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
  scheduler();
}
let visibilityBound = false;
function ensureVisibilityListener(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', onVisibility);
  visibilityBound = true;
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
  ensureVisibilityListener();
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
