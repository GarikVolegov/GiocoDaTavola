import type { ReactNode } from 'react';
import styles from './Stage.module.css';

type StageProps = { variant?: 'host' | 'player'; children: ReactNode };

export function Stage({ variant = 'player', children }: StageProps) {
  return <main className={`${styles.stage} ${styles[variant]}`}>{children}</main>;
}
