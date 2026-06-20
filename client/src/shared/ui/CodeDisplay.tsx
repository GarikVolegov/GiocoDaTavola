import styles from './CodeDisplay.module.css';

export function CodeDisplay({ code }: { code: string }) {
  return <div className={styles.code}>{code}</div>;
}
