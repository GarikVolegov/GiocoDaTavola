import type { ReactNode } from 'react';
import styles from './VoteOption.module.css';

type VoteOptionProps = {
  /** Faction colour: 'a'/'b' = the two dilemma sides, 'accent' = gold (meta picks). */
  faction: 'a' | 'b' | 'accent';
  /** Main text (the option label, a nickname, a bet…). Drives the accessible name. */
  label: ReactNode;
  onClick: () => void;
  /** The big letter shown on the left (e.g. the side A/B). Omit for letter-less picks. */
  letter?: string;
  /** Secondary line under the label. */
  hint?: ReactNode;
  selected?: boolean;
  /** Centre the content (used by the side-by-side swing-bet pair). */
  centered?: boolean;
  'aria-label'?: string;
};

// The single selectable "pick one" button shared by every phone choice screen.
// Replaces ~6 near-identical inline-styled button blocks; all colours come from
// tokens via VoteOption.module.css. Selected state is exposed as aria-pressed.
export function VoteOption({
  faction,
  label,
  onClick,
  letter,
  hint,
  selected = false,
  centered = false,
  'aria-label': ariaLabel,
}: VoteOptionProps) {
  const cls = [styles.option, styles[faction], selected && styles.selected, centered && styles.center]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} aria-pressed={selected} onClick={onClick} aria-label={ariaLabel}>
      {letter && <span className={styles.letter}>{letter}</span>}
      <span className={styles.body}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </button>
  );
}
