import { useNavigate } from 'react-router-dom';
import { Stage, Button } from '../shared/ui';

// "Come si gioca" mostrato come introduzione leggera sulla landing.
const STEPS = ['Vota un dilemma', 'Ascolta le difese', 'Cambia idea (o no!)'];

// Schermata d'ingresso su `/`: introduce il gioco e instrada verso lo schermo
// condiviso (`/host`, "Crea una partita") o il telefono (`/join`, "Partecipa").
export default function Landing() {
  const navigate = useNavigate();
  return (
    <Stage variant="player">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', margin: 0 }}>
        Dibattiti tra amici
      </h1>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-md)',
          margin: 0,
          maxWidth: '28rem',
        }}
      >
        Il party game dove voti, difendi e cambi idea… se ti convincono. 🎭
      </p>

      <ol
        aria-label="Come si gioca"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          color: 'var(--text-muted)',
        }}
      >
        {STEPS.map((step, i) => (
          <li key={step} style={{ fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{i + 1}</span> · {step}
          </li>
        ))}
      </ol>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          width: 'min(90vw, 22rem)',
        }}
      >
        <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => navigate('/host')}>
          Crea una partita
        </Button>
        <Button variant="ghost" size="lg" style={{ width: '100%' }} onClick={() => navigate('/join')}>
          Partecipa
        </Button>
      </div>

      <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-xs)', margin: 0 }}>
        3–8 giocatori · dal vivo
      </p>
    </Stage>
  );
}
