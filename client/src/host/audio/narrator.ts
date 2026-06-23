// Host-only story narration: read the prose aloud with the Web Speech API. ONLY
// the main device (the /host screen) calls this — phones never narrate. Speech is
// gated by the shared mute toggle and one utterance plays at a time (a new line
// cancels the previous so they never overlap). The pure `narrationFor` mapping is
// unit-tested; `speak`/`cancelNarration` are thin Web Speech side-effects.
import type { GamePhase, StoriaView } from '../../shared/events';
import { isMuted } from './engine';

/** The prose to voice for a given phase, or null when there's nothing to read. */
export function narrationFor(phase: GamePhase, storia: StoriaView | null): string | null {
  if (!storia) return null;
  switch (phase) {
    case 'STORY_INTRO':
      return `${storia.title}. ${storia.premessa}`;
    case 'SCENE_INTRO':
      return storia.sceneNarration;
    case 'SCENE_CONSEQUENCE':
      return storia.consequence;
    case 'STORY_EPILOGUE':
      return storia.epilogo;
    default:
      return null;
  }
}

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Whether the browser can speak (Web Speech API present). */
export function narrationAvailable(): boolean {
  return synth() != null;
}

/**
 * Split prose into sentence-sized chunks. The speech engine is fed one chunk at a time
 * so it never chokes on a long passage (Chrome silently stops an utterance after ~15s).
 * Keeps terminators (incl. "…"), trims, drops empties. Pure / unit-tested.
 */
export function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Choose the most natural Italian voice available: Siri / "enhanced" / "premium" voices
 * sound far less robotic than the compact default. Falls back to any it-* voice, else null
 * (the browser then uses its default it-IT voice). Pure / unit-tested.
 */
export function pickBestItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const italian = voices.filter((v) => v.lang?.toLowerCase().startsWith('it'));
  if (italian.length === 0) return null;
  const score = (v: SpeechSynthesisVoice): number => {
    const name = (v.name ?? '').toLowerCase();
    let s = 0;
    if (name.includes('siri')) s += 8;
    if (/enhanced|premium|neural|natural/.test(name)) s += 6;
    if (name.includes('google')) s += 3; // "Google italiano" is a decent remote voice
    if (/alice|federica|luca|paola|emma/.test(name)) s += 2; // known-good Apple it voices
    if (v.lang?.toLowerCase() === 'it-it') s += 1;
    if (v.localService) s += 1;
    return s;
  };
  return italian.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
}

// A new narration line supersedes any queue still in flight; `speakGen` invalidates the old
// one. `keepAliveTimer` nudges the engine so long speech isn't cut off mid-passage.
let speakGen = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function stopKeepAlive(): void {
  if (keepAliveTimer != null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/** Stop any narration in progress (and invalidate its chunk queue). */
export function cancelNarration(): void {
  speakGen += 1;
  stopKeepAlive();
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
}

let primed = false;

/**
 * Prime the speech engine from WITHIN a user gesture (the audio-enable tap). Many
 * browsers (Chrome, Safari) only let speechSynthesis speak after it's been kicked
 * off once inside a real gesture; a near-silent priming utterance unlocks it so
 * the later, programmatic narration actually plays. Safe / idempotent.
 */
export function unlockSpeech(): void {
  const s = synth();
  if (!s || primed) return;
  primed = true;
  try {
    if (s.paused) s.resume();
    const u = new SpeechSynthesisUtterance(' '); // a non-breaking space
    u.volume = 0;
    u.lang = 'it-IT';
    s.speak(u);
  } catch {
    /* ignore — best-effort unlock */
  }
}

/**
 * Speak a line of prose (host only). No-op when muted, unavailable, or empty.
 * `onDone` fires when the utterance ends, errors, or is skipped — used to restore
 * the music bed. Hardened against two real speechSynthesis quirks:
 *  - cancel() ONLY when something is actually playing (an idle cancel() makes the
 *    NEXT utterance silently drop in Chrome — which killed the very first line);
 *  - if the voice list hasn't loaded yet, wait for it instead of speaking voiceless.
 */
export function speak(text: string | null | undefined, onDone?: () => void): void {
  const s = synth();
  const line = (text ?? '').trim();
  if (!s || isMuted() || !line) {
    onDone?.();
    return;
  }
  const gen = (speakGen += 1); // this line supersedes any queue still in flight
  stopKeepAlive();
  if (s.speaking || s.pending) s.cancel(); // never overlap — but don't cancel when idle
  if (s.paused) s.resume(); // recover from a stuck/paused engine

  const chunks = splitIntoSentences(line);
  if (chunks.length === 0) {
    onDone?.();
    return;
  }

  const run = () => {
    if (gen !== speakGen) return; // superseded while waiting for voices
    const voice = pickBestItalianVoice(s.getVoices());
    let i = 0;
    const finish = () => {
      if (gen !== speakGen) return; // a newer line owns the engine now
      stopKeepAlive();
      onDone?.();
    };
    // Chrome stops long speech after ~15s; a periodic pause()/resume() keeps it going.
    keepAliveTimer = setInterval(() => {
      if (s.speaking && !s.paused) {
        s.pause();
        s.resume();
      }
    }, 9000);
    const speakNext = () => {
      if (gen !== speakGen) return;
      if (i >= chunks.length) {
        finish();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = 'it-IT';
      u.rate = 0.98;
      u.pitch = 1;
      if (voice) u.voice = voice;
      u.onend = () => {
        i += 1;
        speakNext();
      };
      u.onerror = finish;
      s.speak(u);
    };
    speakNext();
  };

  // Voice list loads asynchronously; speaking before it's ready can produce no
  // sound. If empty, wait for `voiceschanged` (once), with a timeout fallback.
  if (s.getVoices().length === 0) {
    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      run();
    };
    s.addEventListener('voiceschanged', go, { once: true });
    setTimeout(go, 300);
  } else {
    run();
  }
}
