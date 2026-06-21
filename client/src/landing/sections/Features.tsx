import type { ReactNode } from 'react';
import { FEATURES } from '../content';
import styles from '../Landing.module.css';

// Stroke icons (1.6 hairline, currentColor → gold on the chip). Keyed by feature
// title so content.ts stays the single source of copy; emoji stay only for the
// Awards/personaggi section. Order mirrors FEATURES: deck · persuasion · bots · party.
const ICONS: Record<string, ReactNode> = {
  '60 dilemmi, mai gli stessi': (
    <>
      <rect x="4" y="5" width="11" height="15" rx="1.5" />
      <path d="M8.5 3.5 18.5 6 16 18" />
    </>
  ),
  'Vince chi convince': (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  'Anche in pochi': (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 4.5V8M9.5 13h.01M14.5 13h.01M3 12v3M21 12v3" />
    </>
  ),
  'Nessuno perde': (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 19h6M10 16h4" />
    </>
  ),
};

const FALLBACK_ICON: ReactNode = (
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M9.5 12.5 11.5 14.5 15 10" />
  </>
);

export default function Features() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Perché ti piacerà</p>
      <h2 className={styles.h2}>Fatto per accendere il tavolo</h2>
      <div className={styles.feat}>
        {FEATURES.map((f) => (
          <div className={styles.card} key={f.title}>
            <span className={styles.cardIc} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[f.title] ?? FALLBACK_ICON}
              </svg>
            </span>
            <div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
