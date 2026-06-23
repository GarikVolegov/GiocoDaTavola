import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import styles from './Celebration.module.css';

// CSS custom props aren't in CSSProperties; this lets us pass them type-safely.
type CSSVars = CSSProperties & Record<`--${string}`, string>;

const COLORS = ['a', 'b', 'gold'] as const;

// A one-shot confetti burst overlay for the game's emotional peaks (a swing, a
// duel win, the final awards). Mount it (conditionally) to fire a single burst;
// it's purely decorative (aria-hidden, pointer-events:none) and the whole overlay
// is hidden under prefers-reduced-motion (handled in CSS).
export default function Celebration({ pieces = 28 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.round(Math.random() * 100),
        delay: +(Math.random() * 0.5).toFixed(2),
        dur: +(1.5 + Math.random() * 1.2).toFixed(2),
        dx: Math.round((Math.random() - 0.5) * 24),
        rot: Math.round(360 + Math.random() * 540),
        color: COLORS[i % COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className={styles.root} aria-hidden="true">
      {bits.map((b) => {
        const style: CSSVars = {
          left: `${b.left}%`,
          animationDelay: `${b.delay}s`,
          animationDuration: `${b.dur}s`,
          '--dx': `${b.dx}vw`,
          '--rot': `${b.rot}deg`,
        };
        return <span key={b.id} className={`${styles.piece} ${styles[b.color]}`} style={style} />;
      })}
    </div>
  );
}
