import styles from './Logo.module.css';

interface LogoProps {
  /** wordmark font-size in px; everything scales from it */
  size?: number;
  /** show the italic serif payoff line */
  payoff?: boolean;
  /** wrap in the dark brand panel */
  panel?: boolean;
}

/**
 * SCHIERATI lockup: the "bivio" emblem (one stem splitting into two paths — the
 * dilemma) + the wordmark in Space Grotesk, optional serif payoff. Inline SVG so
 * it's crisp wherever the font is loaded. Replaces the old <img> logo.
 */
export function Logo({ size = 30, payoff = false, panel = false }: LogoProps) {
  return (
    <span
      className={panel ? `${styles.lockup} ${styles.panel}` : styles.lockup}
      style={{ ['--logo-size' as never]: `${size}px` }}
      aria-label="SCHIERATI"
    >
      <svg className={styles.emblem} viewBox="0 0 200 215" aria-hidden="true">
        <path d="M100,205 L100,120" fill="none" stroke="var(--text)" strokeWidth={22} strokeLinecap="round" />
        <path d="M100,120 L42,26" fill="none" stroke="var(--faction-a)" strokeWidth={22} strokeLinecap="round" />
        <path d="M100,120 L158,26" fill="none" stroke="var(--faction-b)" strokeWidth={22} strokeLinecap="round" />
        <circle cx={100} cy={120} r={12} fill="var(--text)" />
      </svg>
      <span className={styles.col}>
        <span className={styles.word}>SCHIERATI</span>
        {payoff && <span className={styles.pay}>il gioco dei dilemmi tra amici</span>}
      </span>
    </span>
  );
}
