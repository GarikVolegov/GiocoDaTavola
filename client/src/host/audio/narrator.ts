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

let preferredVoice: SpeechSynthesisVoice | null = null;

/** Pick (and cache) an Italian voice; falls back to lang-only when none is named. */
function pickItalianVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  preferredVoice = s.getVoices().find((v) => v.lang?.toLowerCase().startsWith('it')) ?? null;
  return preferredVoice;
}

/** Stop any narration in progress. */
export function cancelNarration(): void {
  synth()?.cancel();
}

/**
 * Speak a line of prose (host only). No-op when muted, unavailable, or empty.
 * Cancels any prior utterance first so lines never overlap. `onDone` fires when
 * the utterance ends, errors, or is skipped — used to restore the music bed.
 */
export function speak(text: string | null | undefined, onDone?: () => void): void {
  const s = synth();
  const line = (text ?? '').trim();
  if (!s || isMuted() || !line) {
    onDone?.();
    return;
  }
  s.cancel(); // never overlap; also clears a stuck queue
  const u = new SpeechSynthesisUtterance(line);
  u.lang = 'it-IT';
  u.rate = 0.96;
  const voice = pickItalianVoice(s);
  if (voice) u.voice = voice;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone?.();
  };
  u.onend = finish;
  u.onerror = finish;
  // Voice list may load asynchronously; if it's empty now, set the voice once it
  // arrives (best-effort; the utterance still speaks with the default it-IT voice).
  if (!voice && s.getVoices().length === 0) {
    s.addEventListener(
      'voiceschanged',
      () => {
        const v = pickItalianVoice(s);
        if (v) u.voice = v;
      },
      { once: true },
    );
  }
  s.speak(u);
}
