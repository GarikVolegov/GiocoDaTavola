import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Swing } from '../../shared/ui';
import styles from '../Landing.module.css';

interface HeroProps {
  onCreate: () => void;
  onJoin: () => void;
}

const SAMPLE_DILEMMAS = [
  {
    text: 'UN SOCIO TI PROPONE DI GONFIARE I NUMERI PER CHIUDERE UN INVESTIMENTO.',
    optionA: 'LO FACCIO: I SOLDI SERVONO ORA',
    optionB: 'MAI: LA REPUTAZIONE VALE PIÙ DEI SOLDI',
    baseSplit: 38,
  },
  {
    text: 'SCOPRI CHE IL TUO MIGLIORE AMICO TRADISCE IL PARTNER: GLIELO DICI?',
    optionA: 'SÌ, LA VERITÀ PRIMA DI TUTTO',
    optionB: 'NO, NON SONO AFFARI MIEI',
    baseSplit: 54,
  },
  {
    text: '1 MILIONE SUBITO, MA NON POTRAI MAI PIÙ USCIRE DALLA TUA CITTÀ.',
    optionA: 'ACCETTO SUBITO I SOLDI',
    optionB: 'RIFIUTO: LA LIBERTÀ NON HA PREZZO',
    baseSplit: 29,
  },
] as const;

// Scenic TV-show Hero: crossing A/B spotlights, entrance electric beam,
// interactive live dilemma card, and quick room-code entry alongside CTAs.
export default function Hero({ onCreate, onJoin }: HeroProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<'A' | 'B' | null>(null);
  const [roomCode, setRoomCode] = useState('');

  const current = SAMPLE_DILEMMAS[index];
  const liveSplit =
    picked === 'A'
      ? Math.min(82, current.baseSplit + 18)
      : picked === 'B'
        ? Math.max(18, current.baseSplit - 18)
        : current.baseSplit;

  useEffect(() => {
    document.documentElement.style.setProperty('--bivio-lean', String(liveSplit));
  }, [liveSplit]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty('--bivio-lean', '50');
    };
  }, []);

  const pickSide = (side: 'A' | 'B') => {
    setPicked(side);
    window.dispatchEvent(new CustomEvent('nexus:shockwave'));
  };

  const nextDilemma = () => {
    setIndex((i) => (i + 1) % SAMPLE_DILEMMAS.length);
    setPicked(null);
  };

  const handleQuickJoin = (e: FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim().toUpperCase();
    if (clean.length >= 2) {
      navigate(`/join?code=${encodeURIComponent(clean)}`);
    } else {
      onJoin();
    }
  };

  return (
    <section className={styles.heroFullBleed}>
      <div className={styles.heroSpotlights} aria-hidden="true">
        <div className={styles.spotlightA} />
        <div className={styles.spotlightB} />
        <div className={styles.heroHorizonGlow} />
        <div className={styles.heroBeam} />
      </div>

      <div className={styles.wrap}>
        <div className={styles.heroCentered}>

        <h1 className={styles.heroTitleCentered}>
          <span>SCEGLI UN LATO. </span>
          <span className={styles.a}>DIFENDILO.</span>
          <span className={`${styles.titleLine} ${styles.b}`}>FALLI CAMBIARE IDEA.</span>
        </h1>

        <p className={styles.heroLeadCentered}>
          DILEMMI SCOMODI TRA AMICI. SI VOTA IN SEGRETO, SI DIFENDE LA PROPRIA SCELTA, SI RIVOTA.
          NESSUN VINCITORE — SOLO RISATE E GRANDI VERITÀ.
        </p>

        {/* Interactive Dilemma Showcase */}
        <div className={styles.bivioShowcase}>
          <div className={`${styles.bivioCard} ${styles.bivioCardScenic}`}>
            <div className={styles.bivioCardHead}>
              <span className={styles.deviceLab}>PROVA UN BIVIO DAL VIVO</span>
              <button
                type="button"
                className={styles.bivioCycleBtn}
                onClick={nextDilemma}
              >
                CAMBIA DILEMMA ↻
              </button>
            </div>

            <p className={styles.bivioQuestion}>{current.text}</p>

            <div className={styles.bivioChoiceGrid}>
              <button
                type="button"
                className={`${styles.bivioChoice} ${styles.bivioChoiceA} ${picked === 'A' ? styles.bivioChoiceSelected : ''}`}
                onClick={() => pickSide('A')}
              >
                <span className={styles.optK}>A</span>
                <span>{current.optionA}</span>
              </button>
              <button
                type="button"
                className={`${styles.bivioChoice} ${styles.bivioChoiceB} ${picked === 'B' ? styles.bivioChoiceSelected : ''}`}
                onClick={() => pickSide('B')}
              >
                <span className={styles.optK}>B</span>
                <span>{current.optionB}</span>
              </button>
            </div>

            <div className={styles.bivioMeter}>
              <Swing split={liveSplit} width="100%" height={24} labels />
              <p className={styles.bivioFeedback}>
                {picked
                  ? `HAI SCELTO ${picked} · ORA HAI 30S PER CONVINCERE GLI ALTRI!`
                  : 'TOCCA A O B PER VEDERE IL GRUPPO DIVIDERSI'}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.ctaRow}>
          <Button variant="primary" size="lg" onClick={onCreate}>Crea una partita</Button>

          <form className={styles.quickJoinForm} onSubmit={handleQuickJoin}>
            <input
              type="text"
              inputMode="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CODICE"
              aria-label="Codice stanza"
              className={styles.quickJoinInput}
            />
            <button type="submit" className={styles.quickJoinSubmit}>
              ENTRA →
            </button>
          </form>

          <Button variant="ghost" size="lg" onClick={() => navigate('/passa')}>
            📱 Passa il telefono
          </Button>
        </div>

        <p className={styles.meta}>
          SCHERMO CONDIVISO + SMARTPHONE · 20–40 MIN · NESSUN ACCOUNT RICHIESTO
        </p>

        <a href="#come" className={styles.scrollCue}>
          <span>↓ SCORRI PER SCOPRIRE IL GIOCO</span>
        </a>
        </div>
      </div>
    </section>
  );
}
