import type { VoteSplit } from '../events';
import styles from './BivioBackdrop.module.css';

/**
 * Percentuale di voti sul lato A (0–100). Quando non ci sono voti ritorna 50
 * (neutro). Guida la CSS var --bivio-lean per far "pendere" lo sfondo bivio al
 * SPLIT_REVEAL verso il lato in testa.
 */
export function leanFromSplit(split: VoteSplit): number {
  const total = split.A + split.B;
  if (total === 0) return 50;
  return Math.round((split.A / total) * 100);
}

type BivioBackdropProps = {
  /** host = scena piena; player = scena accennata (UI di gioco leggibile). */
  variant?: 'host' | 'player';
};

/**
 * Sfondo decorativo "bivio in prospettiva": due corsie a ventaglio dal basso
 * (A blu a sinistra, B terracotta a destra) + alone d'orizzonte + velo. Layer
 * fisso dietro al contenuto, aria-hidden e non interattivo. `variant` regola
 * solo l'intensità (--bivio-k). La reattività al reveal arriva dalla CSS var
 * globale --bivio-lean (default 50), impostata da HostApp.
 */
export function BivioBackdrop({ variant = 'player' }: BivioBackdropProps) {
  return (
    <div
      className={styles.backdrop}
      data-testid="bivio-backdrop"
      aria-hidden="true"
      style={{ ['--bivio-k' as never]: variant === 'host' ? '1' : '0.4' }}
    >
      <div className={styles.laneA} />
      <div className={styles.laneB} />
      <div className={styles.veil} />
    </div>
  );
}
