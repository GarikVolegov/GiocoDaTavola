// Shared Web Audio plumbing for the host: a single AudioContext + master gain that
// both the musichetta (music.ts) and the sound effects (sfx.ts) hang off — browsers
// limit how many contexts you can open. Everything no-ops safely when Web Audio is
// unavailable (SSR / tests). Host-only.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

const MUTE_KEY = 'schierati.audio.muted';

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Lazily create the shared context + master gain. Returns null if Web Audio is missing. */
export function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1; // a mute gate; per-source gains keep the mix quiet
    master.connect(ctx.destination);
  }
  return ctx;
}

/** The master gain node (created alongside the context), or null if unavailable. */
export function getMaster(): GainNode | null {
  getCtx();
  return master;
}

/** Resume the context after a user gesture (browser autoplay policy). */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

export function isMuted(): boolean {
  return muted;
}

/** Mute/unmute everything (persisted). Music keeps running silently; SFX skip while muted. */
export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* storage unavailable — keep the in-memory flag */
  }
  const c = getCtx();
  if (c && master) {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setTargetAtTime(next ? 0 : 1, c.currentTime, 0.02);
  }
}
