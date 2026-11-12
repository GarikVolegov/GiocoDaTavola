import { useEffect, useRef } from 'react';

/**
 * Keeps the screen awake on mobile and desktop while `active` is true.
 * Essential for party games where players hold phones during narration and voting
 * and screens might otherwise sleep, breaking audio playback and socket connections.
 * Safely no-ops in unsupported browsers and tests.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isMounted = true;

    const requestLock = async () => {
      try {
        if (document.visibilityState === 'visible' && !sentinelRef.current) {
          const sentinel = await navigator.wakeLock.request('screen');
          if (isMounted) {
            sentinelRef.current = sentinel;
            sentinel.onrelease = () => {
              if (sentinelRef.current === sentinel) {
                sentinelRef.current = null;
              }
            };
          } else {
            await sentinel.release();
          }
        }
      } catch {
        /* ignore — best effort */
      }
    };

    void requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [active]);
}
