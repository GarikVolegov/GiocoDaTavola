import type { CSSProperties, ReactNode } from 'react';
import styles from './Pill.module.css';

type PillProps = {
  selected?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  /** Optional inline overrides (e.g. a full-width, left-aligned list item). */
  style?: CSSProperties;
  children: ReactNode;
};

export function Pill({ selected, onClick, children, style, ...aria }: PillProps) {
  const cls = [styles.pill, selected && styles.selected].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected} style={style} {...aria}>
        {children}
      </button>
    );
  }
  return <span className={cls} style={style} {...aria}>{children}</span>;
}
