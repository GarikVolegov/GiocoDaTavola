import { useEffect, useRef, type ReactNode } from 'react';
import styles from './MobilePhaseShell.module.css';

interface MobilePhaseShellProps {
  title: string;
  remaining?: number | null;
  roundText?: string | null;
  children: ReactNode;
  dock?: ReactNode;
}

export default function MobilePhaseShell({
  title,
  remaining,
  roundText,
  children,
  dock,
}: MobilePhaseShellProps) {
  // Capture the highest remaining value observed in this phase so the progress
  // bar scales smoothly from 100% -> 0% even without knowing the server constant.
  const maxRemainingRef = useRef<number>(remaining ?? 0);
  const lastTitleRef = useRef<string>(title);

  if (lastTitleRef.current !== title) {
    lastTitleRef.current = title;
    maxRemainingRef.current = remaining ?? 0;
  }
  useEffect(() => {
    if (remaining != null && remaining > maxRemainingRef.current) {
      maxRemainingRef.current = remaining;
    }
  }, [remaining]);

  const max = Math.max(1, maxRemainingRef.current || remaining || 1);
  const pct = remaining != null ? Math.max(0, Math.min(100, (remaining / max) * 100)) : null;
  const urgency =
    remaining == null ? '' : remaining <= 3 ? styles.danger : remaining <= 6 ? styles.warn : '';

  return (
    <main className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <h1 className={styles.phaseTitle}>{title}</h1>
          <div className={styles.badges}>
            {roundText && <span className={styles.roundPill}>{roundText}</span>}
            {remaining != null && (
              <span className={`${styles.timerPill} ${urgency}`} aria-label="Tempo rimanente">
                {remaining}s
              </span>
            )}
          </div>
        </div>
        {pct != null && (
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={`${styles.progressFill} ${urgency}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </header>

      <div key={title} className={styles.stage}>{children}</div>

      {dock && <div className={styles.dock}>{dock}</div>}
    </main>
  );
}
