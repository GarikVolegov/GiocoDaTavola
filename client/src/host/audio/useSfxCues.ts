import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../../shared/useCountdown';
import { unlockAudio } from './engine';
import { play as playSfx } from './sfx';
import { sfxForTransition, shouldWarnAt, handRaised } from './cues';
import { getSocket } from '../../shared/socket';
import { SocketEvents, type GameStatePayload, type GamePhase } from '../../shared/events';

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

  // The leader's "Scarta dilemma" re-reveals the round: from DILEMMA_REVEAL that's
  // a same-phase (silent) re-entry, but from an open VOTE_1 it's a REAL transition
  // (VOTE_1 -> DILEMMA_REVEAL) that sfxForTransition would read as a normal
  // 'reveal' — doubling up with the 'discard' whoosh below. The server always
  // emits room:dilemmaSkipped before the game:state that carries the new phase
  // (same socket, so delivery order is preserved), so setting this ref the
  // moment the event arrives is guaranteed to land before the phase-transition
  // effect below runs for that same discard.
  const suppressNextTransitionRef = useRef(false);
  useEffect(() => {
    const socket = getSocket();
    const onDiscard = () => {
      suppressNextTransitionRef.current = true;
      if (active) playSfx('discard');
    };
    socket.on(SocketEvents.RoomDilemmaSkipped, onDiscard);
    return () => {
      socket.off(SocketEvents.RoomDilemmaSkipped, onDiscard);
    };
  }, [active]);

  const prevPhaseRef = useRef<GamePhase | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (suppressNextTransitionRef.current) {
      suppressNextTransitionRef.current = false;
      return;
    }
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
