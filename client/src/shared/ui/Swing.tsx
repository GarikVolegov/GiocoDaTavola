import styles from './Swing.module.css';

interface SwingProps {
  /** bar width in px */
  width?: number;
  /** bar height in px */
  height?: number;
  /** percent of votes on side A (0-100); ignored when animated */
  split?: number;
  /** show A / B end labels */
  labels?: boolean;
  /** loading/empty-state: the divider eases back and forth */
  animated?: boolean;
}

/**
 * The "swing" motif — the group's A/B split as one bar. The brand is about
 * persuasion, so with `animated` the divider eases across (the room changing its
 * mind). Use for empty/loading states or a live SPLIT_REVEAL tally.
 */
export function Swing({ width = 220, height = 14, split = 50, labels = false, animated = false }: SwingProps) {
  return (
    <div className={styles.swing} style={{ ['--sw-h' as never]: `${height}px` }} aria-label="Divisione dei voti">
      {labels && (
        <div className={styles.ab}>
          <span className={styles.a}>A</span>
          <span className={styles.b}>B</span>
        </div>
      )}
      <div className={styles.bar} style={{ width, height }}>
        <div
          className={animated ? `${styles.fill} ${styles.anim}` : styles.fill}
          style={animated ? undefined : { width: `${split}%` }}
        />
      </div>
    </div>
  );
}
