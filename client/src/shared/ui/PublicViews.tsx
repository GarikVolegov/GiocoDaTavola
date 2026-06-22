// Pure presentation components for the game's PUBLIC phases — the views that
// look the same on every phone and on the optional TV (/host). Props-typed from
// events.ts; they carry only aggregate, non-secret data (never who voted what).
import { COMPLESSITA_LABELS, type PublicDilemma, type VoteSplit, type PublicSwing, type Award } from '../events';
import { Card } from './index';

/** The dilemma prompt + its two options. Used in DILEMMA_REVEAL / VOTE_*. */
export function DilemmaCard({ dilemma }: { dilemma: PublicDilemma }) {
  return (
    <Card glow="accent" style={{ width: 'min(92vw, 40rem)' }}>
      {dilemma.complessita && (
        <span
          style={{
            display: 'inline-block',
            margin: '0 0 0.5rem',
            padding: '0.15rem 0.6rem',
            borderRadius: 'var(--radius-pill, 999px)',
            border: '1px solid var(--gold-line, rgba(201,163,90,0.5))',
            color: 'var(--gold, #C9A35A)',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {COMPLESSITA_LABELS[dilemma.complessita]}
        </span>
      )}
      <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.6rem' }}>{dilemma.text}</p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span><strong>A</strong> · {dilemma.optionA}</span>
        <span><strong>B</strong> · {dilemma.optionB}</span>
      </div>
    </Card>
  );
}

/** The aggregate A/B split as a proportional bar + counts (SPLIT_REVEAL). */
export function SplitBar({ split }: { split: VoteSplit }) {
  const total = split.A + split.B || 1;
  const pctA = Math.round((split.A / total) * 100);
  return (
    <div style={{ width: 'min(92vw, 40rem)' }}>
      <div style={{ display: 'flex', height: '2.5rem', borderRadius: '0.6rem', overflow: 'hidden' }}>
        <div style={{ width: `${pctA}%`, background: 'rgba(84,134,196,0.6)' }} />
        <div style={{ width: `${100 - pctA}%`, background: 'rgba(199,122,69,0.6)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontWeight: 700 }}>
        <span>A · {split.A}</span>
        <span>{split.B} · B</span>
      </div>
    </div>
  );
}

/** The persuasion swing + per-defender attribution (PHASE_RESULTS). Aggregate
 * counts only — never who voted what. */
export function ResultsPanel({ swing }: { swing: PublicSwing }) {
  return (
    <section
      aria-label="Risultati della persuasione"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', maxWidth: 'min(92vw, 50rem)' }}
    >
      <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
        {swing.switched === 0
          ? 'Nessuno ha cambiato idea 🪨'
          : `${swing.switched} ${swing.switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea! 🔄`}
      </p>
      {swing.attribution.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {swing.attribution.map((imp) => (
            <p key={imp.defender.id} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
              Le difese di <span style={{ color: 'var(--gold)' }}>{imp.defender.nickname}</span> hanno
              spostato {imp.votes} {imp.votes === 1 ? 'voto' : 'voti'} verso {imp.defender.side}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** The fun end-of-game superlatives (FINAL_AWARDS). */
export function AwardsPanel({ awards }: { awards: Award[] }) {
  if (awards.length === 0) {
    return <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>Grazie per aver giocato! 🎉</p>;
  }
  return (
    <section
      aria-label="Premi finali"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', maxWidth: 'min(92vw, 60rem)' }}
    >
      {awards.map((a) => (
        <Card
          key={a.id}
          glow="accent"
          style={{ flex: '1 1 16rem', minWidth: '14rem', maxWidth: '18rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center', textAlign: 'center' }}
        >
          <span style={{ fontSize: '2.5rem' }}>{a.emoji}</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>{a.title}</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>{a.winner.nickname}</span>
          <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>{a.description}</span>
        </Card>
      ))}
    </section>
  );
}
