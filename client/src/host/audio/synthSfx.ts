/**
 * Native Web Audio API sound synthesizer for Schierati party game.
 * Zero external MP3 files: synthesizes ticks, sirens, gongs, and fanfares
 * directly through the browser's AudioContext.
 */

import { getCtx, getMaster, isMuted } from './engine';

function getDest(): { ctx: AudioContext; dest: AudioNode } | null {
  if (isMuted()) return null;
  const ctx = getCtx();
  const dest = getMaster();
  if (!ctx || !dest) return null;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return { ctx, dest };
}

/**
 * Subtle percussive tick for countdown urgency (3-2-1).
 */
export function playTick(): void {
  const setup = getDest();
  if (!setup) return;
  const { ctx, dest } = setup;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + 0.045);
}

/**
 * Emergency warbling siren for L'Infiltrato debate and urgency.
 */
export function playSiren(): void {
  const setup = getDest();
  if (!setup) return;
  const { ctx, dest } = setup;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  // Dual-tone siren warble: 600Hz -> 950Hz -> 600Hz -> 950Hz -> 600Hz over 1.2s
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.linearRampToValueAtTime(950, now + 0.25);
  osc.frequency.linearRampToValueAtTime(600, now + 0.5);
  osc.frequency.linearRampToValueAtTime(950, now + 0.75);
  osc.frequency.linearRampToValueAtTime(600, now + 1.0);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
  gain.gain.setValueAtTime(0.18, now + 0.95);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + 1.2);
}

/**
 * Deep, resonant gong for "La Gogna" in Assurdo mode.
 */
export function playGong(): void {
  const setup = getDest();
  if (!setup) return;
  const { ctx, dest } = setup;
  const now = ctx.currentTime;

  // Fundamental + overtone for metallic gong body
  const freqs = [110, 224, 336];
  const gains = [0.25, 0.15, 0.08];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 1.8);

    const initialGain = gains[idx];
    gain.gain.setValueAtTime(initialGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (idx === 0 ? 2.2 : 1.2));

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 2.3);
  });
}

/**
 * Triumphant ascending fanfare for match / toast / celebration.
 */
export function playFanfare(): void {
  const setup = getDest();
  if (!setup) return;
  const { ctx, dest } = setup;
  const now = ctx.currentTime;

  // Arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  const notes = [
    { freq: 523.25, start: 0, dur: 0.15 },
    { freq: 659.25, start: 0.12, dur: 0.15 },
    { freq: 783.99, start: 0.24, dur: 0.18 },
    { freq: 1046.5, start: 0.38, dur: 0.6 },
  ];

  notes.forEach((n) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const t = now + n.start;
    osc.frequency.setValueAtTime(n.freq, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + n.dur + 0.05);
  });
}
