import { useEffect, useState } from 'react';

// Show a server value for `durationMs` after it changes, then revert to null
// locally — for state that arrives once and is never cleared server-side
// (e.g. a turn's applause snapshot, still broadcast on every game:state until
// the NEXT turn ends), so the UI can treat it as a transient toast instead of
// a value that lingers for the whole next turn. Keyed by JSON identity so a
// redundant re-broadcast of the same snapshot doesn't restart the timer.
export function useTransient<T>(value: T | null, durationMs: number): T | null {
  const [shown, setShown] = useState<T | null>(null);
  const key = value == null ? null : JSON.stringify(value);

  useEffect(() => {
    if (key == null) {
      setShown(null);
      return;
    }
    setShown(value);
    const id = setTimeout(() => setShown(null), durationMs);
    return () => clearTimeout(id);
    // `value` is intentionally omitted: `key` is its content-derived identity.
  }, [key, durationMs]);

  return shown;
}
