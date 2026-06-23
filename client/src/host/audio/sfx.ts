// Fire-and-forget sound effects for the host, synthesized on the shared context. Each
// recipe is a tiny envelope over one or more oscillators. Skipped while muted; no-ops
// when Web Audio is unavailable.

import { getCtx, getMaster, isMuted } from './engine';
import type { SfxName } from './cues';

interface ToneSpec {
  freq: number;
  /** Glide to this frequency over the note (for sweeps); defaults to `freq`. */
  freqEnd?: number;
  start: number; // seconds offset from "now"
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function tone(ctx: AudioContext, dest: AudioNode, t0: number, spec: ToneSpec): void {
  const osc = ctx.createOscillator();
  osc.type = spec.type ?? 'sine';
  const when = t0 + spec.start;
  osc.frequency.setValueAtTime(spec.freq, when);
  if (spec.freqEnd && spec.freqEnd !== spec.freq) {
    osc.frequency.exponentialRampToValueAtTime(spec.freqEnd, when + spec.dur);
  }
  const g = ctx.createGain();
  const peak = spec.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + spec.dur + 0.03);
}

// One recipe per effect. `t0` is the context time the effect starts at.
const RECIPES: Record<SfxName, (ctx: AudioContext, dest: AudioNode, t0: number) => void> = {
  // Bright rising two-note chime — "something was revealed".
  reveal: (ctx, dest, t0) => {
    tone(ctx, dest, t0, { freq: 587.33, start: 0, dur: 0.18, gain: 0.16 }); // D5
    tone(ctx, dest, t0, { freq: 880.0, start: 0.1, dur: 0.34, gain: 0.16 }); // A5
  },
  // Dramatic downward swoop + low hit — the majority flipped (ribaltone).
  swing: (ctx, dest, t0) => {
    tone(ctx, dest, t0, { freq: 660, freqEnd: 160, start: 0, dur: 0.45, type: 'sawtooth', gain: 0.14 });
    tone(ctx, dest, t0, { freq: 110, start: 0.18, dur: 0.5, type: 'triangle', gain: 0.2 });
  },
  // Ascending major fanfare — a duel round was won.
  win: (ctx, dest, t0) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => tone(ctx, dest, t0, { freq: f, start: i * 0.09, dur: 0.3, type: 'triangle', gain: 0.16 }));
  },
  // Sparkly arpeggio over a major chord — finale / awards.
  awards: (ctx, dest, t0) => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C E G C E
    notes.forEach((f, i) => tone(ctx, dest, t0, { freq: f, start: i * 0.08, dur: 0.4, type: 'sine', gain: 0.14 }));
  },
  // Soft single tick — the countdown is almost up.
  timerWarn: (ctx, dest, t0) => {
    tone(ctx, dest, t0, { freq: 740, start: 0, dur: 0.09, type: 'sine', gain: 0.12 });
  },
  // Gentle two-tone ding — a new hand went up.
  handRaise: (ctx, dest, t0) => {
    tone(ctx, dest, t0, { freq: 784, start: 0, dur: 0.12, type: 'sine', gain: 0.12 }); // G5
    tone(ctx, dest, t0, { freq: 1046.5, start: 0.07, dur: 0.2, type: 'sine', gain: 0.12 }); // C6
  },
};

/** Play a one-shot sound effect on the host. Respects mute; safe when audio is unavailable. */
export function play(name: SfxName): void {
  if (isMuted()) return;
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;
  void ctx.resume();
  RECIPES[name](ctx, master, ctx.currentTime);
}
