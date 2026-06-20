import styles from './Countdown.module.css';

type CountdownProps = { seconds: number | null };

export function Countdown({ seconds }: CountdownProps) {
  if (seconds == null) return null;
  const cls = `${styles.countdown} ${seconds <= 10 ? styles.urgent : ''}`.trim();
  return (
    <div aria-label="Tempo rimanente" className={cls}>
      {seconds}s
    </div>
  );
}
