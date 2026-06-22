import { useEffect, useState } from 'react';
import { elapsedSeconds } from './time';

// Live count-UP from a server-computed turn-start timestamp (epoch ms). Mirror of
// useCountdown: the server is authoritative about WHEN the turn started; the client
// only renders the whole seconds elapsed. Returns null when there is no active turn.
export function useElapsed(startedAt: number | null): number | null {
  const [elapsed, setElapsed] = useState<number | null>(() => elapsedSeconds(startedAt, Date.now()));

  useEffect(() => {
    if (startedAt == null) {
      setElapsed(null);
      return;
    }
    const tick = () => setElapsed(elapsedSeconds(startedAt, Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}
