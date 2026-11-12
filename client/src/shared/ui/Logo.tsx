import { useId } from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  /** wordmark font-size in px; everything scales from it */
  size?: number;
  /** show the italic serif payoff line */
  payoff?: boolean;
  /** wrap in the dark brand panel */
  panel?: boolean;
  /** extra class on the lockup span — lets callers tweak size (e.g. --logo-size) responsively */
  className?: string;
}

/**
 * NEXUS lockup: the dual-faction prism emblem (blue vs orange sides cleft
 * by the central nexus bolt — the dilemma) + the wordmark "NEXUS" in display font,
 * optional serif payoff "L'Orizzonte dei Bivi". Inline SVG so it's crisp wherever
 * loaded.
 */
export function Logo({ size = 30, payoff = false, panel = false, className }: LogoProps) {
  const cls = [styles.lockup, panel && styles.panel, className].filter(Boolean).join(' ');
  // Unique per instance so multiple <Logo>s on one page never share a clip id.
  const clip = useId();
  return (
    <span
      className={cls}
      style={{ ['--logo-size' as never]: `${size}px` }}
      aria-label="NEXUS · L'Orizzonte dei Bivi"
    >
      <svg className={styles.emblem} viewBox="0 0 512 512" aria-hidden="true">
        <defs>
          <clipPath id={clip}><rect width={512} height={512} rx={112} /></clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x={0} y={0} width={256} height={512} fill="#4F8DFF" />
          <rect x={256} y={0} width={256} height={512} fill="#E07B39" />
          <path d="M300,52 L196,250 L256,250 L212,460 L330,232 L268,232 Z" fill="#0E1224" />
          <path d="M292,64 L208,256 L262,256 L226,448 L324,238 L272,238 Z" fill="#FFFFFF" />
        </g>
      </svg>
      <span className={styles.col}>
        <span className={styles.word}>NEXUS</span>
        {payoff && <span className={styles.pay}>L’Orizzonte dei Bivi</span>}
      </span>
    </span>
  );
}
