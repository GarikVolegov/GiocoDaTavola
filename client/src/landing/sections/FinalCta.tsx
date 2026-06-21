import { Button } from '../../shared/ui';
import styles from '../Landing.module.css';

interface FinalCtaProps {
  onCreate: () => void;
}

export default function FinalCta({ onCreate }: FinalCtaProps) {
  return (
    <div className={styles.final}>
      <h2 className={styles.finalH}>
        Pronti a <span className={styles.a}>schierar</span><span className={styles.b}>vi</span>?
      </h2>
      <p className={styles.finalP}>Apri lo schermo grande, fai inquadrare il QR agli amici e via.</p>
      <Button variant="primary" size="lg" onClick={onCreate}>⚡ Crea una partita</Button>
      <p className={styles.foot}>Gratis · niente download · niente account · dal browser</p>
    </div>
  );
}
