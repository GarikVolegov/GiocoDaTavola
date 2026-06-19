import { useEffect, useState } from 'react';

// Render a live countdown from a server-computed expiry timestamp (epoch ms).
// The server is authoritative about WHEN a phase ends; the client only renders
// the remaining whole seconds. Returns null when there is no active timer.
export function useCountdown(expiresAt: number | null): number | null {
  const compute = () =>
    expiresAt == null ? null : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const [remaining, setRemaining] = useState<number | null>(compute);

  useEffect(() => {
    if (expiresAt == null) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}
