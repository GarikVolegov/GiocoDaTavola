// Pure presentation components for the game's PUBLIC phases — the views that
// look the same on every phone and on the optional TV (/host). Props-typed from
// events.ts; they carry only aggregate, non-secret data (never who voted what).
import { COMPLESSITA_LABELS, type PublicDilemma, type VoteSplit, type PublicSwing, type DefenseImpact, type Award, type NamedMoment, type PodiumEntry } from '../events';
import { Card, CardGrid } from './index';
import Celebration from './Celebration';

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
      <p style={{ fontSize: 'clamp(1.15rem, 2.4vw, 1.9rem)', fontWeight: 700, margin: '0 0 var(--space-3)' }}>{dilemma.text}</p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap', fontSize: 'clamp(0.95rem, 1.6vw, 1.25rem)' }}>
        <span><strong>A</strong> · {dilemma.optionA}</span>
        <span><strong>B</strong> · {dilemma.optionB}</span>
      </div>
    </Card>
  );
}

/** The aggregate A/B split as a proportional bar + counts (SPLIT_REVEAL).
 * Sized to fill its PARENT (not the raw viewport) so it stays contained when
 * nested in a narrower card, e.g. the phone's GROUP_MIND_REVEAL — a hardcoded
 * `92vw` here previously overflowed that card's own (narrower) width. */
export function SplitBar({ split }: { split: VoteSplit }) {
  const total = split.A + split.B || 1;
  const pctA = Math.round((split.A / total) * 100);
  return (
    <div style={{ width: '100%', maxWidth: '40rem' }}>
      <div style={{ display: 'flex', height: '2.5rem', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
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

/**
 * Which defender to credit for a genuine "ribaltone" — the lead itself
 * flipping, or 2+ voters switching side — and null when neither happened (a
 * single switch that didn't change the leader is a swing, not a ribaltone).
 */
export function ribaltoneHero(swing: PublicSwing): DefenseImpact | null {
  if (!swing.leadFlipped && swing.switched < 2) return null;
  if (swing.attribution.length === 0) return null;
  return swing.attribution.reduce((best, imp) => (imp.votes > best.votes ? imp : best));
}

/** The persuasion swing + per-defender attribution (PHASE_RESULTS). Aggregate
 * counts only — never who voted what. */
export function ResultsPanel({ swing }: { swing: PublicSwing }) {
  const hero = ribaltoneHero(swing);
  return (
    <section
      aria-label="Risultati della persuasione"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', maxWidth: 'min(92vw, 50rem)' }}
    >
      {/* A swing (someone actually changed their mind) is the round's emotional peak. */}
      {swing.switched > 0 && <Celebration />}
      {hero && (
        <p style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)', fontWeight: 800, margin: 0, color: 'var(--gold)' }}>
          🌀 IL RIBALTONE DI {hero.defender.nickname.toUpperCase()}!
        </p>
      )}
      <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
        {swing.switched === 0
          ? 'Nessuno ha cambiato idea 🪨'
          : `${swing.switched} ${swing.switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea! 🔄`}
      </p>
      {swing.attribution.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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

/**
 * "I momenti della serata" (5.5): the game's titled highlights, shown before
 * the awards at FINAL_AWARDS. A shareable recap — the group's own word-of-
 * mouth artifact. Renders nothing when the game produced no named moments
 * (e.g. a very short or very flat game).
 */
export function NamedMomentsPanel({ moments }: { moments: NamedMoment[] }) {
  if (moments.length === 0) return null;
  return (
    <section aria-label="I momenti della serata" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
      <p style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 800, margin: 0 }}>✨ I momenti della serata</p>
      <CardGrid min={16} aria-label="Momenti della serata">
        {moments.map((m, i) => (
          <Card
            key={`${m.kind}-${m.dilemmaIndex}-${i}`}
            glow="accent"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'center', textAlign: 'center' }}
          >
            <span style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)' }}>{m.emoji}</span>
            <span style={{ fontSize: 'clamp(1rem, 1.8vw, 1.3rem)', fontWeight: 800 }}>{m.title}</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{m.description}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Round {m.dilemmaIndex}</span>
          </Card>
        ))}
      </CardGrid>
    </section>
  );
}

/**
 * The end-of-game podium: the top-3 "Punti Serata" steps (2° | 1° | 3°, gold
 * center) + the compact full ranking below when more players ranked. Ex-aequo
 * players share a step (the skipped medal simply doesn't appear). `meId`
 * highlights the viewer's own row on phones. Point totals only — never votes.
 */
export function PodiumPanel({ podium, meId }: { podium: PodiumEntry[]; meId?: string | null }) {
  if (podium.length === 0) return null;
  const name = (e: PodiumEntry) => (e.player.id === meId ? `${e.player.nickname} (tu)` : e.player.nickname);
  const steps = [
    { rank: 2, medal: '🥈', height: '4.5rem' },
    { rank: 1, medal: '🥇', height: '6.5rem' },
    { rank: 3, medal: '🥉', height: '3.2rem' },
  ];
  const offPodium = podium.filter((e) => e.rank > 3);
  return (
    <section
      aria-label="Il podio della serata"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%', alignItems: 'center' }}
    >
      <p style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 800, margin: 0 }}>🏆 Il podio della serata</p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', justifyContent: 'center', width: 'min(92vw, 34rem)' }}>
        {steps.map(({ rank, medal, height }) => {
          const who = podium.filter((e) => e.rank === rank);
          if (who.length === 0) return <div key={rank} style={{ flex: 1 }} />;
          const totale = who[0].points;
          return (
            <div key={rank} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.8rem)' }}>{medal}</span>
              <span
                style={{
                  fontWeight: 800,
                  textAlign: 'center',
                  fontSize: 'clamp(1rem, 2vw, 1.4rem)',
                  color: rank === 1 ? 'var(--gold)' : undefined,
                }}
              >
                {who.map(name).join(' · ')}
              </span>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                {totale} {totale === 1 ? 'punto' : 'punti'}
              </span>
              <div
                style={{
                  width: '100%',
                  minHeight: height,
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  background: rank === 1 ? 'var(--gold-soft)' : 'var(--surface-2)',
                  border: '2px solid',
                  borderColor: rank === 1 ? 'var(--gold-line)' : 'var(--border-strong)',
                  borderBottom: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  opacity: 0.9,
                }}
              >
                {rank}°
              </div>
            </div>
          );
        })}
      </div>
      {offPodium.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: 'min(92vw, 24rem)' }}>
          {offPodium.map((e) => (
            <p
              key={e.player.id}
              style={{ margin: 0, fontSize: '0.95rem', opacity: 0.85, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}
            >
              <span style={{ fontWeight: e.player.id === meId ? 800 : 500 }}>
                {e.rank}° {name(e)}
              </span>
              <span>
                {e.points} {e.points === 1 ? 'punto' : 'punti'}
              </span>
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
    <>
      <Celebration pieces={40} />
      <CardGrid min={15} aria-label="Premi finali">
        {awards.map((a) => (
          <Card
            key={a.id}
            glow="accent"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center', textAlign: 'center' }}
          >
            <span style={{ fontSize: 'clamp(2.2rem, 4vw, 3.4rem)' }}>{a.emoji}</span>
            <span style={{ fontSize: 'clamp(1.15rem, 2vw, 1.6rem)', fontWeight: 800 }}>{a.title}</span>
            <span style={{ fontSize: 'clamp(1.3rem, 2.4vw, 2rem)', fontWeight: 700, color: 'var(--gold)' }}>{a.winner.nickname}</span>
            <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>{a.description}</span>
          </Card>
        ))}
      </CardGrid>
    </>
  );
}
