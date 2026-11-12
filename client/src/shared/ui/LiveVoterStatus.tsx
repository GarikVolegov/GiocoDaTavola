import styles from './LiveVoterStatus.module.css';

interface LiveVoterStatusProps {
  votedCount: number;
  totalCount: number;
  label?: string;
  confirmedMode?: boolean;
}

/**
 * Broadcast-style anonymous voting status matrix.
 * Displays live glowing cosmic orbs as players commit their choices on their phones,
 * creating tangible room suspense without spoiling which side (A or B) they picked.
 */
export function LiveVoterStatus({
  votedCount,
  totalCount,
  label = 'Hanno votato',
  confirmedMode = false,
}: LiveVoterStatusProps) {
  const safeTotal = Math.max(totalCount, 1);
  const clampedVoted = Math.min(Math.max(votedCount, 0), safeTotal);

  return (
    <div className={styles.container} aria-live="polite">
      <p className={styles.countLabel}>
        <span>{confirmedMode ? 'Confermati' : label}</span>
        <span className={styles.highlightCount}>
          {clampedVoted} / {safeTotal}
        </span>
      </p>

      <div className={styles.orbGrid} aria-label={`${clampedVoted} su ${safeTotal} votanti pronti`}>
        {Array.from({ length: safeTotal }, (_, i) => {
          const isVoted = i < clampedVoted;
          return (
            <span
              key={i}
              className={`${styles.orb} ${isVoted ? styles.orbVoted : styles.orbPending}`}
              title={isVoted ? 'Scelta inviata' : 'In attesa'}
            />
          );
        })}
      </div>
    </div>
  );
}
