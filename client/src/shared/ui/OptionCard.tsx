import styles from './OptionCard.module.css';

type OptionCardProps = { faction: 'a' | 'b'; letter: string; label: string };

export function OptionCard({ faction, letter, label }: OptionCardProps) {
  return (
    <div className={`${styles.option} ${styles[faction]}`}>
      <span className={styles.letter}>{letter}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
