import { useEffect, useState, useCallback } from 'react';
import { isWaitingPhase } from '../../shared/time';
import { unlockAudio } from './engine';
import {
  startThematicMusic,
  stopThematicMusic,
  setThematicIntensity,
  pickMusicThemeForGame,
} from './thematicMusic';
import { play as playSfx } from './sfx';
import { useSfxCues } from './useSfxCues';
import { narrationFor, unlockSpeech } from './narrator';
import {
  getStoryAudioUrl,
  playStoryAudio,
  stopStoryAudio,
  replayStoryAudio,
  prefetchStoryAudio,
} from './storyAudioPlayer';
import type { GameStatePayload, GamePhase } from '../../shared/events';

interface UseHostAudioArgs {
  /** When true, this device acts as audio director (the shared TV screen or leader's phone). */
  enabled: boolean;
  game: GameStatePayload | null;
}

interface UseHostAudioResult {
  /** Whether audio has been unlocked by a user gesture (browser autoplay policy). */
  audioReady: boolean;
  /** Explicit unlock from a tap (gate button) — unlock + a confirmation chime. */
  activateAudio: () => void;
  /** Manually replay the current narration line. */
  replay: () => void;
  /** The current line of prose being narrated, or null. */
  narrationLine: string | null;
  /** The high-fidelity audio asset URL, or null if using speech synthesis. */
  audioUrl: string | null;
}

/**
 * Audio director hook: plays background music and the proprietary studio neural voice
 * (Diego) on each story beat and dilemma. Also fires shared event stings via `useSfxCues`.
 */
export function useHostAudio({ enabled, game }: UseHostAudioArgs): UseHostAudioResult {
  const phase: GamePhase = game?.phase ?? 'LOBBY';
  const speaking = phase === 'DEFENSE' || phase === 'INTERVENTI';

  // Unlock on the first user gesture (the browser autoplay policy needs a gesture).
  const [audioReady, setAudioReady] = useState(false);
  const activateAudio = useCallback(() => {
    if (!enabled) return;
    unlockAudio();
    unlockSpeech(); // prime TTS inside this gesture so narration can speak later
    setAudioReady(true);
    playSfx('reveal');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onGesture = () => {
      unlockAudio();
      unlockSpeech();
      setAudioReady(true);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('touchstart', onGesture, { once: true });
    window.addEventListener('click', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchstart', onGesture);
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [enabled]);

  // "active" = this device should be making sound AND audio is unlocked.
  const active = enabled && audioReady;

  // Thematic background music adapts to mode, phase & dilemma; stops elsewhere / on unmount.
  const musicTheme = pickMusicThemeForGame(game);
  useEffect(() => {
    if (active && isWaitingPhase(phase)) startThematicMusic(musicTheme);
    else stopThematicMusic();
  }, [active, phase, musicTheme]);
  // Duck the bed under a speaker so it never competes with someone talking.
  useEffect(() => {
    setThematicIntensity(speaking ? 'soft' : 'full');
  }, [speaking]);
  useEffect(() => () => stopThematicMusic(), []);

  // Neural audio & fallback narration:
  // If an authored studio MP3 asset exists (or on-demand TTS URL), it plays that.
  // Otherwise, falls back to the local Web Speech engine.
  const audioUrl = getStoryAudioUrl(phase, game?.storia ?? null, game?.dilemma ?? null);
  const narrationLine = narrationFor(phase, game?.storia ?? null, game?.dilemma ?? null);

  useEffect(() => {
    if (!active || (!audioUrl && !narrationLine)) {
      stopStoryAudio();
      return;
    }
    playStoryAudio(audioUrl, narrationLine);
    return () => stopStoryAudio();
  }, [active, audioUrl, narrationLine]);
  useEffect(() => () => stopStoryAudio(), []);

  // Prefetch upcoming audio assets in background so transitions play with 0ms delay
  useEffect(() => {
    if (!active || !game?.storia) return;
    const s = game.storia;
    const base = `/audio/stories/${s.storyId}`;
    if (phase === 'STORY_INTRO') {
      prefetchStoryAudio(`${base}/scene_0.mp3`);
      prefetchStoryAudio(`${base}/bivio_0.mp3`);
    } else if (phase === 'SCENE_INTRO') {
      const idx = s.sceneIndex;
      prefetchStoryAudio(`${base}/bivio_${idx}.mp3`);
      prefetchStoryAudio(`${base}/consequence_${idx}_A.mp3`);
      prefetchStoryAudio(`${base}/consequence_${idx}_B.mp3`);
    } else if (phase === 'VOTE_1' || phase === 'DILEMMA_REVEAL') {
      const idx = Math.max(0, s.sceneIndex - 1);
      prefetchStoryAudio(`${base}/consequence_${idx}_A.mp3`);
      prefetchStoryAudio(`${base}/consequence_${idx}_B.mp3`);
    } else if (phase === 'SCENE_CONSEQUENCE') {
      const nextIdx = s.sceneIndex;
      if (nextIdx < s.totalScenes) {
        prefetchStoryAudio(`${base}/scene_${nextIdx}.mp3`);
      } else {
        prefetchStoryAudio(`${base}/epilogue_0.mp3`);
        prefetchStoryAudio(`${base}/epilogue_1.mp3`);
        prefetchStoryAudio(`${base}/epilogue_2.mp3`);
      }
    }
  }, [active, phase, game?.storia]);

  const replay = useCallback(() => {
    if (!active) return;
    replayStoryAudio(audioUrl, narrationLine);
  }, [active, audioUrl, narrationLine]);

  // Event stings (reveal/swing/win/awards/timerWarn/handRaise) are shared with other
  // phones in the room (6.1) — the host screen/leader gets them through the same path.
  useSfxCues({ enabled, game });

  return { audioReady, activateAudio, replay, narrationLine, audioUrl };
}
