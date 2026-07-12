import { Button, Swing } from '../../shared/ui';
import { NORTHSTAR_URL } from '../../shared/northstar';
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
      <div className={styles.finalSwing}>
        <Swing animated width={240} height={14} labels />
      </div>
      <Button variant="primary" size="lg" onClick={onCreate}>Crea una partita</Button>
      <p className={styles.northstarNote}>
        SCHIERATI è il gioco gratuito nato da{' '}
        <a href={NORTHSTAR_URL} target="_blank" rel="noopener noreferrer">NorthStar</a>
        , l'app madre per orientarti sul serio nelle scelte di carriera e crescita.
      </p>
      <p className={styles.foot}>Gratis · niente download · niente account · dal browser</p>
    </div>
  );
}
