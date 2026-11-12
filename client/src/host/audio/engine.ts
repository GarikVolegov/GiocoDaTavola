// Shared Web Audio plumbing for the host: a single AudioContext + master gain that
// both the musichetta (music.ts) and the sound effects (sfx.ts) hang off — browsers
// limit how many contexts you can open. Everything no-ops safely when Web Audio is
// unavailable (SSR / tests). Host-only.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
let sharedAudio: HTMLAudioElement | null = null;
const muteListeners = new Set<(muted: boolean) => void>();

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

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

/** Returns the blessed shared HTMLAudioElement for mobile fallback playback. */
export function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio && typeof Audio !== 'undefined') {
    sharedAudio = new Audio();
  }
  return sharedAudio;
}

/** Resume the context and prime audio element after a user gesture (browser autoplay policy). */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') {
    void c.resume();
  }

  // Prime HTMLAudioElement on iOS Safari during gesture
  if (typeof window !== 'undefined') {
    try {
      const a = getSharedAudio();
      if (a && !a.src) {
        a.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => a.pause()).catch(() => {});
        }
      }
    } catch {
      /* ignore — best effort */
    }
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Mute/unmute everything (persisted). Music keeps running silently; SFX skip while muted. */
export function setMuted(next: boolean): void {
  muted = next;
  for (const fn of muteListeners) fn(next);
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
