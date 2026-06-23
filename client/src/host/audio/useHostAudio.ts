import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../../shared/useCountdown';
import { isWaitingPhase } from '../../shared/time';
import { unlockAudio } from './engine';
import { startMusic, stopMusic, setMusicIntensity } from './music';
import { play as playSfx } from './sfx';
import { sfxForTransition, shouldWarnAt, handRaised } from './cues';
import { speak, cancelNarration, narrationFor, unlockSpeech } from './narrator';
import type { GameStatePayload, GamePhase } from '../../shared/events';

interface UseHostAudioArgs {
  /** Only this device makes sound (the leader's phone). When false the hook is inert. */
  enabled: boolean;
  game: GameStatePayload | null;
}

interface UseHostAudioResult {
  /** Whether audio has been unlocked by a user gesture (browser autoplay policy). */
  audioReady: boolean;
  /** Explicit unlock from a tap (gate button) — unlock + a confirmation chime. */
  activateAudio: () => void;
}

/**
 * The whole "audio director" for a single device: a quiet background musichetta during
 * waiting/speaking phases, event sound effects on phase changes, and the Storie narrator
 * voice on each narrative beat. Extracted from HostApp so the LEADER's phone can host the
 * audio (only one device makes sound — no cacophony). Inert unless `enabled` is true.
 */
export function useHostAudio({ enabled, game }: UseHostAudioArgs): UseHostAudioResult {
  const phase: GamePhase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);
  const speaking = phase === 'DEFENSE' || phase === 'INTERVENTI';

  // Unlock on the first user gesture (the browser autoplay policy needs a gesture).
  const [audioReady, setAudioReady] = useState(false);
  const activateAudio = () => {
    if (!enabled) return;
    unlockAudio();
    unlockSpeech(); // prime TTS inside this gesture so narration can speak later
    setAudioReady(true);
    playSfx('reveal');
  };
  useEffect(() => {
    if (!enabled) return;
    const onGesture = () => {
      unlockAudio();
      unlockSpeech();
      setAudioReady(true);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [enabled]);

  // "active" = this device should be making sound AND audio is unlocked.
  const active = enabled && audioReady;

  // The musichetta plays in waiting/speaking phases and stops elsewhere / on unmount.
  useEffect(() => {
    if (active && isWaitingPhase(phase)) startMusic();
    else stopMusic();
  }, [active, phase]);
  // Duck the bed under a speaker so it never competes with someone talking.
  useEffect(() => {
    setMusicIntensity(speaking ? 'soft' : 'full');
  }, [speaking]);
  useEffect(() => () => stopMusic(), []);

  // Storie: read each narrative beat aloud. Ducks the music under the voice and restores
  // it when the line ends; a phase change cancels any line in progress. Keyed on the prose
  // so it fires exactly once per beat.
  const narrationLine = narrationFor(phase, game?.storia ?? null);
  useEffect(() => {
    if (!active || !narrationLine) {
      cancelNarration();
      return;
    }
    setMusicIntensity('soft');
    speak(narrationLine, () => setMusicIntensity('full'));
    return () => cancelNarration();
  }, [active, narrationLine]);
  useEffect(() => () => cancelNarration(), []);

  // Event sound effects: fire a sting when the phase changes to a noteworthy moment.
  const prevPhaseRef = useRef<GamePhase | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!active || !game) return;
    const cue = sfxForTransition(prev, phase, game);
    if (cue) playSfx(cue);
  }, [phase, active, game]);

  // Soft ticks in the final seconds of a countdown — but not while someone is speaking.
  const prevRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;
    if (active && !speaking && shouldWarnAt(prev, remaining)) playSfx('timerWarn');
  }, [remaining, active, speaking]);

  // A gentle ding whenever a new hand joins the intervention queue.
  const prevQueueLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = phase === 'INTERVENTI' ? game?.defense?.queue?.length ?? null : null;
    const prev = prevQueueLenRef.current;
    prevQueueLenRef.current = len;
    if (active && handRaised(prev, len)) playSfx('handRaise');
  }, [phase, active, game]);

  return { audioReady, activateAudio };
}
