import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../../shared/useCountdown';
import { unlockAudio } from './engine';
import { play as playSfx } from './sfx';
import { sfxForTransition, shouldWarnAt, handRaised } from './cues';
import type { GameStatePayload, GamePhase } from '../../shared/events';

interface UseSfxCuesArgs {
  enabled: boolean;
  game: GameStatePayload | null;
}

/**
 * Short event stings (reveal/swing/win/awards/timerWarn/handRaise) on EVERY phone in the
 * room, not just the leader's — so the group's beat (countdown ticks, reveal stings)
 * lands everywhere at once (6.1, "energia collettiva"). No musichetta, no narrator voice:
 * those stay leader-only (`useHostAudio`) so 8 phones don't sing over each other.
 * Unlocks silently on this device's first tap — players tap constantly to vote, so no
 * dedicated gate overlay is needed here (unlike the leader's passive /host screen).
 */
export function useSfxCues({ enabled, game }: UseSfxCuesArgs): void {
  const phase: GamePhase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);
  const speaking = phase === 'DEFENSE' || phase === 'INTERVENTI';

  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const onGesture = () => {
      unlockAudio();
      setAudioReady(true);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [enabled]);

  const active = enabled && audioReady;

  const prevPhaseRef = useRef<GamePhase | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!active || !game) return;
    const cue = sfxForTransition(prev, phase, game);
    if (cue) playSfx(cue);
  }, [phase, active, game]);

  const prevRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;
    if (active && !speaking && shouldWarnAt(prev, remaining)) playSfx('timerWarn');
  }, [remaining, active, speaking]);

  const prevQueueLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = phase === 'INTERVENTI' ? game?.defense?.queue?.length ?? null : null;
    const prev = prevQueueLenRef.current;
    prevQueueLenRef.current = len;
    if (active && handRaised(prev, len)) playSfx('handRaise');
  }, [phase, active, game]);
}
