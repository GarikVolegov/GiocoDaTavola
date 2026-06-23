import type { CSSProperties, ReactNode } from 'react';
import styles from './CardGrid.module.css';

// CSS custom props aren't in CSSProperties; this lets us pass them type-safely.
type CSSVars = CSSProperties & Record<`--${string}`, string>;

type CardGridProps = {
  children: ReactNode;
  /** Minimum column width in rem (default 14). Columns stay equal and wrap. */
  min?: number;
  /** Max grid width (CSS length). Default min(92vw, 60rem). */
  max?: string;
  className?: string;
  'aria-label'?: string;
};

// Equal-column responsive grid for clusters of cards/score tiles (awards, duel
// scores, picks). Replaces flex-wrap with `flex: '1 1 Xrem'` per card, which gave
// uneven widths + misaligned borders. Generalises Home's .statsGrid/.awards.
export function CardGrid({ children, min = 14, max, className, 'aria-label': ariaLabel }: CardGridProps) {
  const style: CSSVars = { '--cg-min': `${min}rem` };
  if (max) style['--cg-max'] = max;
  const cls = [styles.grid, className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={style} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
