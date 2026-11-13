import { lazy, Suspense, useEffect, useState } from 'react';
import type { VoteSplit } from '../events';
import styles from './BivioBackdrop.module.css';

const Nexus3DCanvas = lazy(() =>
  import('../nexus3d/Nexus3DCanvas').then((m) => ({ default: m.Nexus3DCanvas })),
);

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

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
  /** host = scena piena; player = scena accennata; landing = epica d'apertura; dashboard = elegante */
  variant?: 'host' | 'player' | 'landing' | 'dashboard';
  phase?: string;
  isRibaltone?: boolean;
};

/**
 * Sfondo immersivo "Nexus 3D & Bivio in prospettiva":
 * Canvas 3D procedurale Three.js con due sentieri di luce e monoliti cosmici
 * + velo e corsie sfumate per garantire leggibilità del testo su qualsiasi schermo.
 */
export function BivioBackdrop({ variant = 'player', phase, isRibaltone }: BivioBackdropProps) {
  const intensity = variant === 'host' ? '1' : variant === 'landing' ? '0.85' : '0.4';
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      className={styles.backdrop}
      data-testid="bivio-backdrop"
      aria-hidden="true"
      style={{ ['--bivio-k' as never]: intensity }}
    >
      {!reducedMotion && (
        <Suspense fallback={null}>
          <Nexus3DCanvas variant={variant} phase={phase} isRibaltone={isRibaltone} />
        </Suspense>
      )}
      <div className={styles.laneA} />
      <div className={styles.laneB} />
      <div className={styles.veil} />
    </div>
  );
}

