import type { ReactNode } from 'react';
import styles from './Pill.module.css';

type PillProps = {
  selected?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  children: ReactNode;
};

export function Pill({ selected, onClick, children, ...aria }: PillProps) {
  const cls = [styles.pill, selected && styles.selected].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected} {...aria}>
        {children}
      </button>
    );
  }
  return <span className={cls} {...aria}>{children}</span>;
}
