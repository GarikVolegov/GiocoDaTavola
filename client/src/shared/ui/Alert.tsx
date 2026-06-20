import type { ReactNode } from 'react';
import styles from './Alert.module.css';

export function Alert({ tone = 'danger', children }: { tone?: 'danger'; children: ReactNode }) {
  return (
    <p role="alert" className={`${styles.alert} ${styles[tone]}`}>
      {children}
    </p>
  );
}
