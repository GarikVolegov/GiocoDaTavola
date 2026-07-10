import { useEffect, useState } from 'react';
import { isWaitingPhase } from '../../shared/time';
import { unlockAudio } from './engine';
import { startMusic, stopMusic, setMusicIntensity } from './music';
import { play as playSfx } from './sfx';
import { useSfxCues } from './useSfxCues';
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
 * The LEADER-only audio director: a quiet background musichetta during waiting/speaking
 * phases plus the Storie narrator voice on each narrative beat (only one device plays
 * these — no cacophony from 8 phones). Also fires the shared event stings via
 * `useSfxCues`, which every other phone in the room plays independently (6.1). Inert
 * unless `enabled` is true.
 */
export function useHostAudio({ enabled, game }: UseHostAudioArgs): UseHostAudioResult {
  const phase: GamePhase = game?.phase ?? 'LOBBY';
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

  // Event stings (reveal/swing/win/awards/timerWarn/handRaise) are shared with every
  // other phone in the room (6.1) — the leader gets them through the same path, gated
  // by the same `enabled`/`active` unlock as everything else here.
  useSfxCues({ enabled, game });

  return { audioReady, activateAudio };
}
