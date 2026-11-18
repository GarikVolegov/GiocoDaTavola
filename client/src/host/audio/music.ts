// The background "musichetta". It loops on the AUDIO THREAD: we render one pass of a
// themed progression (from sequence.ts) into an AudioBuffer once per theme, then play it
// with loop=true.
//
// Why not a setInterval look-ahead scheduler? /host is usually NOT the focused tab while
// people play (they're on their phones / the player view) and is often an embedded preview
// (e.g. VS Code's browser). Browsers throttle — or outright freeze — JS timers in
// background/hidden views, which would stall a timer-driven scheduler and kill the music.
// A looping AudioBufferSourceNode keeps playing regardless of JS-timer state, as long as
// the AudioContext is running. Ducking stays real-time via the bus gain.

import { getCtx, getMaster } from './engine';
import { themeMeta, themeNoteAt, type NoteEvent, type SynthThemeId } from './sequence';

export type MusicIntensity = 'full' | 'soft';

let musicGain: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
const bufferCache = new Map<SynthThemeId, AudioBuffer>();
const renderingThemes = new Set<SynthThemeId>();
let activeTheme: SynthThemeId = 'ambient-warm';
let running = false; // "should be playing" — survives the async render
let intensity: MusicIntensity = 'full';

// Overall loudness of the bed; "soft" ducks under a speaker without going silent.
// Tuned so the musichetta is clearly audible as background music (≈ -15 dBFS peak).
const BED_GAIN: Record<MusicIntensity, number> = { full: 0.3, soft: 0.12 };

function offlineCtor(): typeof OfflineAudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext ??
    null
  );
}

// Render one loop of the selected theme into an AudioBuffer (offline, once — then cached).
async function renderLoop(theme: SynthThemeId, sampleRate: number): Promise<AudioBuffer | null> {
  const Ctor = offlineCtor();
  if (!Ctor) return null;
  const { loopSteps, secondsPerBeat } = themeMeta(theme);
  const length = Math.ceil(loopSteps * secondsPerBeat * sampleRate);
  const off = new Ctor(1, length, sampleRate);
  for (let step = 0; step < loopSteps; step++) {
    const when = step * secondsPerBeat;
    for (const note of themeNoteAt(theme, step)) {
      scheduleNote(off, off.destination, note, when, secondsPerBeat);
    }
  }
  return off.startRendering();
}

function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  note: NoteEvent,
  when: number,
  secondsPerBeat: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = note.oscType ?? 'triangle';
  osc.frequency.value = note.freq;

  const g = ctx.createGain();
  const dur = note.durationBeats * secondsPerBeat;
  // Quick attack, smooth exponential release — no clicks.
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(note.gain, when + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  if (note.filterHz && typeof ctx.createBiquadFilter === 'function') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = note.filterHz;
    filter.Q.value = 0.7;
    osc.connect(filter);
    filter.connect(g);
  } else {
    osc.connect(g);
  }

  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// Start the looping source — only once the buffer is ready and we still want to play this theme.
function beginPlayback(theme: SynthThemeId): void {
  const ctx = getCtx();
  const buf = bufferCache.get(theme);
  if (!running || activeTheme !== theme || !buf || !ctx || !musicGain) return;
  if (source) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    source.disconnect();
    source = null;
  }
  source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.connect(musicGain);
  source.start();
}

export function startMusic(theme: SynthThemeId = 'ambient-warm'): void {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  // Already playing this exact theme — nothing to do.
  if (running && activeTheme === theme && source) return;

  void ctx.resume();
  activeTheme = theme;
  running = true;

  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = BED_GAIN[intensity];
    musicGain.connect(master);
  }

  if (bufferCache.has(theme)) {
    beginPlayback(theme);
    return;
  }

  if (!renderingThemes.has(theme)) {
    renderingThemes.add(theme);
    renderLoop(theme, ctx.sampleRate)
      .then((buf) => {
        renderingThemes.delete(theme);
        if (buf) bufferCache.set(theme, buf);
        beginPlayback(theme);
      })
      .catch(() => {
        renderingThemes.delete(theme);
      });
  }
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
