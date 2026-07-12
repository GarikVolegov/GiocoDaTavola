import { PHASE_LABELS, type DuoPortrait } from '../../shared/events';
import { Card, Button, Celebration } from '../../shared/ui';
import { wrap } from './layout';

interface PortraitViewProps {
  portrait: DuoPortrait | null;
  isLeader: boolean;
  onRematch: () => void;
}

// Percorso in 2 finale (DUO_PORTRAIT): the couple portrait — sintonia %, who
// knows the other best, the night's moment, the playful micro-verdict and two
// titles each. Phone-first: the whole finale lives here, no TV needed.
export default function PortraitView({ portrait, isLeader, onRematch }: PortraitViewProps) {
  const scores = portrait?.scores ?? [];
  const winner = portrait?.winnerId ? scores.find((s) => s.id === portrait.winnerId) : null;
  const loser = portrait?.winnerId ? scores.find((s) => s.id !== portrait.winnerId) : null;
  return (
    <main style={wrap}>
      <Celebration pieces={40} />
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DUO_PORTRAIT}</h1>
      {portrait && (
        <>
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            <p style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0 }}>{portrait.sintoniaPct}%</p>
            <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
              Sintonia di coppia — d'accordo su {portrait.agreements}{' '}
              {portrait.agreements === 1 ? 'dilemma' : 'dilemmi'} su {portrait.truePicks}
            </p>
            {portrait.tiConosco.length > 0 && (
              <p style={{ fontSize: '0.9rem', opacity: 0.8, margin: 0 }}>
                🔮 Previsioni azzeccate:{' '}
                {portrait.tiConosco.map((t) => `${t.nickname} ${t.hits}`).join(' · ')}
              </p>
            )}
          </Card>
          {portrait.momento && (
            <Card style={{ width: 'min(90vw, 22rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <p style={{ fontSize: '1.6rem', margin: 0 }}>{portrait.momento.emoji}</p>
              <p style={{ fontWeight: 800, margin: 0 }}>{portrait.momento.title}</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.8, margin: 0 }}>{portrait.momento.description}</p>
            </Card>
          )}
          <p style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
            {winner && loser
              ? `Stasera l'ha spuntata ${winner.nickname}, ${winner.total}-${loser.total}`
              : 'Pareggio perfetto — sintonia totale 🤝'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}>
            {portrait.titoli.map((t) => (
              <Card key={`${t.playerId}-${t.title}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 800 }}>
                  {t.emoji} {t.title} — {t.nickname}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>{t.description}</p>
              </Card>
            ))}
          </div>
        </>
      )}
      {isLeader && (
        <Button variant="primary" onClick={onRematch} style={{ marginTop: '0.25rem' }}>
          Giocate ancora ▶
        </Button>
      )}
    </main>
  );
}
