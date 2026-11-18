// Story narration: read the prose aloud with the Web Speech API. Both the shared /host
// screen and the leader's phone call this (via useHostAudio). Speech is gated by the
// shared mute toggle and one utterance plays at a time (a new line cancels the previous
// so they never overlap). `narrationFor` is purely derived from (phase, storia, dilemma),
// so a fresh device picks the narration straight back up wherever the story currently
// stands, with no lost state. Hardened against Web Speech quirks:
//  - Keeps activeUtterance in module scope to prevent V8 garbage collection mid-sentence
//    (which stops onend from firing in Chrome / Android).
//  - Avoids empty utterance priming that causes WebKit/Safari to deadlock its queue.
//  - Watchdog timer to automatically recover if an utterance fails to emit onend.
//  - Highest preference for modern natural and neural Italian voices.
//  - Reactive hook useIsSpeaking to observe speech status in UI.

import { useEffect, useState } from 'react';
import type { GamePhase, StoriaView } from '../../shared/events';
import { isMuted } from './engine';

export interface NarrationOptions {
  /** Whether to read classic/percorso dilemmas aloud (defaults to true). */
  readClassicDilemmas?: boolean;
}

export interface DilemmaTextTarget {
  id?: string;
  text: string;
  optionA: string;
  optionB: string;
}

/** The prose to voice for a given phase, or null when there's nothing to read. */
export function narrationFor(
  phase: GamePhase,
  storia: StoriaView | null,
  dilemma?: DilemmaTextTarget | null,
  options?: NarrationOptions,
): string | null {
  if (storia) {
    switch (phase) {
      case 'STORY_INTRO': {
        const who = storia.protagonist ? ` Con ${storia.protagonist}.` : '';
        return `${storia.title}.${who} ${storia.premessa}`.trim();
      }
      case 'SCENE_INTRO': {
        return storia.sceneNarration ? storia.sceneNarration.trim() : null;
      }
      case 'DILEMMA_REVEAL':
      case 'VOTE_1': {
        if (!dilemma) return null;
        return `${dilemma.text} ${dilemma.optionA}, oppure ${dilemma.optionB}.`.trim();
      }
      case 'SCENE_CONSEQUENCE': {
        if (!storia.consequence) return null;
        const choice = storia.decision;
        const choiceText =
          choice === 'A'
            ? dilemma?.optionA
            : choice === 'B'
              ? dilemma?.optionB
              : null;
        const lead = choiceText ? `Il gruppo ha scelto: ${choiceText}. ` : '';
        return `${lead}${storia.consequence}`.trim();
      }
      case 'STORY_EPILOGUE':
        return storia.epilogo ? storia.epilogo.trim() : null;
      default:
        return null;
    }
  }

  // Classic or Percorso dilemma narration
  const readClassic = options?.readClassicDilemmas ?? true;
  if (readClassic && (phase === 'DILEMMA_REVEAL' || phase === 'VOTE_1')) {
    if (!dilemma) return null;
    return `${dilemma.text} ${dilemma.optionA}, oppure ${dilemma.optionB}.`.trim();
  }

  return null;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Whether the browser can speak (Web Speech API present). */
export function narrationAvailable(): boolean {
  return synth() != null;
}

type NarrationListener = (speaking: boolean) => void;
const listeners = new Set<NarrationListener>();
let currentSpeaking = false;

export function notifySpeaking(speaking: boolean): void {
  if (currentSpeaking !== speaking) {
    currentSpeaking = speaking;
    for (const listener of listeners) {
      try {
        listener(speaking);
      } catch {
        /* ignore listener error */
      }
    }
  }
}

export function isNarrationSpeaking(): boolean {
  return currentSpeaking;
}

export function subscribeNarrationState(listener: NarrationListener): () => void {
  listeners.add(listener);
  listener(currentSpeaking);
  return () => {
    listeners.delete(listener);
  };
}

export function useIsSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(isNarrationSpeaking);
  useEffect(() => subscribeNarrationState(setSpeaking), []);
  return speaking;
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
 * Choose the most natural Italian voice available: Siri / "enhanced" / "premium" / "natural"
 * voices sound far less robotic than the compact default. Falls back to any it-* voice, else null
 * (the browser then uses its default it-IT voice). Pure / unit-tested.
 */
export function pickBestItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const italian = voices.filter((v) => v.lang?.toLowerCase().startsWith('it'));
  if (italian.length === 0) return null;
  const score = (v: SpeechSynthesisVoice): number => {
    const name = (v.name ?? '').toLowerCase();
    let s = 0;
    if (name.includes('siri')) s += 10;
    if (/natural|neural/.test(name)) s += 9;
    if (/enhanced|premium/.test(name)) s += 7;
    if (/luca|cosimo|diego|matteo|alessandro|giorgio|fabrizio|carlo|male/.test(name)) s += 6; // Prioritize male voices
    if (name.includes('google')) s += 5; // "Google italiano" is a decent remote voice
    if (/online/.test(name)) s += 4;
    if (/alice|federica|paola|emma|elsa/.test(name)) s += 2; // female fallback voices
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
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

function stopKeepAlive(): void {
  if (keepAliveTimer != null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function clearWatchdog(): void {
  if (watchdogTimer != null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

/** Stop any narration in progress (and invalidate its chunk queue). */
export function cancelNarration(): void {
  speakGen += 1;
  stopKeepAlive();
  clearWatchdog();
  activeUtterance = null;
  notifySpeaking(false);
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
}

let primed = false;

/**
 * Prime the speech engine from WITHIN a user gesture (the audio-enable tap). Many
 * browsers (Chrome, Safari) only let speechSynthesis speak after it's been kicked
 * off once inside a real gesture. Safe / idempotent.
 */
export function unlockSpeech(): void {
  const s = synth();
  if (!s) return;
  try {
    if (s.paused) s.resume();
    // Warm up voices
    s.getVoices();
    if (!primed) {
      primed = true;
      // On iOS Safari, calling speak with a near-silent instant utterance inside a real gesture
      // unlocks the speech synthesis engine for the entire session.
      const u = new SpeechSynthesisUtterance('.');
      u.volume = 0.001;
      u.rate = 10;
      u.lang = 'it-IT';
      u.onend = () => {};
      u.onerror = () => {};
      s.speak(u);
    }
  } catch {
    /* ignore — best-effort unlock */
  }
}

/**
 * Speak a line of prose. No-op when muted, unavailable, or empty.
 * `onDone` fires when the utterance ends, errors, or is skipped — used to restore
 * the music bed. Hardened against real speechSynthesis quirks:
 *  - cancel() ONLY when something is actually playing;
 *  - if the voice list hasn't loaded yet, wait for it instead of speaking voiceless;
 *  - keeps activeUtterance reference in module scope to prevent GC mid-sentence;
 *  - uses a watchdog timer to recover if onend fails to fire.
 */
export function speak(text: string | null | undefined, onDone?: () => void, rate = 1.0): void {
  const s = synth();
  const line = (text ?? '').trim();
  if (!s || isMuted() || !line) {
    notifySpeaking(false);
    onDone?.();
    return;
  }
  const gen = (speakGen += 1); // this line supersedes any queue still in flight
  stopKeepAlive();
  clearWatchdog();
  if (s.speaking || s.pending) s.cancel(); // never overlap — but don't cancel when idle
  if (s.paused) s.resume(); // recover from a stuck/paused engine

  const chunks = splitIntoSentences(line);
  if (chunks.length === 0) {
    notifySpeaking(false);
    onDone?.();
    return;
  }

  notifySpeaking(true);

  const run = () => {
    if (gen !== speakGen) return; // superseded while waiting for voices
    const voice = pickBestItalianVoice(s.getVoices());
    let i = 0;
    const finish = () => {
      if (gen !== speakGen) return; // a newer line owns the engine now
      stopKeepAlive();
      clearWatchdog();
      activeUtterance = null;
      notifySpeaking(false);
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

      clearWatchdog();
      const u = new SpeechSynthesisUtterance(chunks[i]);
      activeUtterance = u; // Keep reference to prevent GC in Chrome
      u.lang = 'it-IT';
      u.rate = rate;
      u.pitch = 1.0;
      if (voice) u.voice = voice;

      // Watchdog: recover automatically if browser drops onend
      const expectedMs = Math.max(6000, chunks[i].length * 150 + 4000);
      watchdogTimer = setTimeout(() => {
        if (gen === speakGen && activeUtterance === u) {
          clearWatchdog();
          i += 1;
          speakNext();
        }
      }, expectedMs);

      u.onend = () => {
        clearWatchdog();
        i += 1;
        speakNext();
      };
      u.onerror = () => {
        clearWatchdog();
        finish();
      };
      s.speak(u);
    };

    speakNext();
  };

  // Run speech immediately so gesture activation is preserved on mobile browsers.
  // If voices are already loaded, pickBestItalianVoice selects the best one;
  // otherwise setting u.lang = 'it-IT' tells the browser to use its default Italian voice.
  run();
}
