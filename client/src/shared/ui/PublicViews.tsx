// Pure presentation components for the game's PUBLIC phases.
// Stylized with the "Cyber-Ethereal Oracle" design system.
import {
  COMPLESSITA_LABELS,
  type PublicDilemma,
  type VoteSplit,
  type PublicSwing,
  type DefenseImpact,
  type Award,
  type NamedMoment,
  type PodiumEntry,
} from '../events';
import { Card, CardGrid } from './index';
import Celebration from './Celebration';
import styles from './PublicViews.module.css';

/** The dilemma prompt + its two options. Used in DILEMMA_REVEAL / VOTE_*. */
export function DilemmaCard({ dilemma }: { dilemma: PublicDilemma }) {
  return (
    <Card glow="accent" className={styles.dilemmaContainer}>
      <div className={styles.dilemmaHeader}>
        <span className={styles.kickerNexus}>🌌 NEXUS · IL BIVIO</span>
        {dilemma.complessita && (
          <span className={styles.kickerComplexity}>
            {COMPLESSITA_LABELS[dilemma.complessita]}
          </span>
        )}
      </div>

      <p className={styles.dilemmaText}>{dilemma.text}</p>

      <div className={styles.optionsGrid}>
        <div className={styles.optionCardA}>
          <span className={styles.letterBadgeA}>A</span>
          <span className={styles.optionLabel}>{dilemma.optionA}</span>
        </div>

        <div className={styles.optionCardB}>
          <span className={styles.letterBadgeB}>B</span>
          <span className={styles.optionLabel}>{dilemma.optionB}</span>
        </div>
      </div>
    </Card>
  );
}

/** The aggregate A/B split as a proportional bar + counts (SPLIT_REVEAL). */
export function SplitBar({ split }: { split: VoteSplit }) {
  const total = split.A + split.B || 1;
  const pctA = Math.round((split.A / total) * 100);
  const pctB = 100 - pctA;

  return (
    <div className={styles.splitBarContainer}>
      <div className={styles.splitBarTrack}>
        <div className={styles.splitBarA} style={{ width: `${pctA}%` }}>
          {pctA >= 15 && `${pctA}%`}
        </div>
        <div className={styles.splitLaserDivider} style={{ left: `${pctA}%` }} />
        <div className={styles.splitBarB} style={{ width: `${pctB}%` }}>
          {pctB >= 15 && `${pctB}%`}
        </div>
      </div>
      <div className={styles.splitLabelsRow}>
        <span className={styles.splitLabelA}>
          Lato A · {split.A} {split.A === 1 ? 'voto' : 'voti'}
        </span>
        <span className={styles.splitLabelB}>
          {split.B} {split.B === 1 ? 'voto' : 'voti'} · Lato B
        </span>
      </div>
    </div>
  );
}

export function ribaltoneHero(swing: PublicSwing): DefenseImpact | null {
  if (!swing.leadFlipped && swing.switched < 2) return null;
  if (swing.attribution.length === 0) return null;
  return swing.attribution.reduce((best, imp) => (imp.votes > best.votes ? imp : best));
}

/** The persuasion swing + per-defender attribution (PHASE_RESULTS). */
export function ResultsPanel({ swing, dilemma }: { swing: PublicSwing; dilemma?: PublicDilemma | null }) {
  const hero = ribaltoneHero(swing);
  return (
    <section
      aria-label="Risultati della persuasione"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        maxWidth: 'min(92vw, 50rem)',
      }}
    >
      {swing.switched > 0 && <Celebration />}
      {hero && (
        <div
          style={{
            padding: '0.4rem 1.4rem',
            borderRadius: 'var(--radius-pill)',
            background: 'linear-gradient(135deg, rgba(229, 193, 88, 0.22) 0%, rgba(245, 108, 56, 0.2) 100%)',
            border: '1.5px solid var(--gold)',
            boxShadow: 'var(--glow-accent)',
            animation: 'pulseGlow 2s infinite',
          }}
        >
          <p
            style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.6rem)',
              fontWeight: 800,
              margin: 0,
              color: 'var(--gold)',
              letterSpacing: '0.02em',
            }}
          >
            🌀 IL RIBALTONE DI {hero.defender.nickname.toUpperCase()}!
          </p>
        </div>
      )}
      <p style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.4rem)', fontWeight: 800, margin: 0 }}>
        {swing.switched === 0
          ? 'Nessuno ha cambiato idea 🪨'
          : `${swing.switched} ${swing.switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea! 🔄`}
      </p>
      {swing.attribution.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {swing.attribution.map((imp) => (
            <p key={imp.defender.id} style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
              Le difese di <span style={{ color: 'var(--gold)' }}>{imp.defender.nickname}</span> hanno spostato{' '}
              {imp.votes} {imp.votes === 1 ? 'voto' : 'voti'} verso {imp.defender.side}
            </p>
          ))}
        </div>
      )}
      {dilemma?.lezioneReale && (
        <div data-testid="oracolo-lezione" className={styles.oracleCard}>
          <div className={styles.oracleBadge}>
            💡 L’Oracolo della Realtà · Insegnamento
          </div>
          <p className={styles.oracleText}>
            "{dilemma.lezioneReale}"
          </p>
        </div>
      )}
    </section>
  );
}

/** I momenti della serata recap. */
export function NamedMomentsPanel({ moments }: { moments: NamedMoment[] }) {
  if (moments.length === 0) return null;
  return (
    <section
      aria-label="I momenti della serata"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}
    >
      <p style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 800, margin: 0 }}>✨ I momenti della serata</p>
      <CardGrid min={16} aria-label="Momenti della serata">
        {moments.map((m, i) => (
          <Card
            key={`${m.kind}-${m.dilemmaIndex}-${i}`}
            glow="accent"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
              alignItems: 'center',
              textAlign: 'center',
            }}
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

/** The end-of-game podium with metallic reflective steps. */
export function PodiumPanel({ podium, meId }: { podium: PodiumEntry[]; meId?: string | null }) {
  if (podium.length === 0) return null;
  const name = (e: PodiumEntry) => (e.player.id === meId ? `${e.player.nickname} (tu)` : e.player.nickname);
  const steps = [
    {
      rank: 2,
      medal: '🥈',
      height: '5.5rem',
      bg: 'linear-gradient(to top, rgba(160, 175, 205, 0.15) 0%, rgba(210, 225, 250, 0.35) 100%)',
      border: '#B0C0DA',
      glow: '0 0 20px rgba(176, 192, 218, 0.3)',
    },
    {
      rank: 1,
      medal: '🥇',
      height: '7.8rem',
      bg: 'linear-gradient(to top, rgba(229, 193, 88, 0.22) 0%, rgba(255, 235, 150, 0.45) 100%)',
      border: '#E5C158',
      glow: 'var(--glow-accent)',
    },
    {
      rank: 3,
      medal: '🥉',
      height: '4.2rem',
      bg: 'linear-gradient(to top, rgba(200, 115, 65, 0.15) 0%, rgba(235, 155, 105, 0.35) 100%)',
      border: '#CD7F32',
      glow: '0 0 20px rgba(205, 127, 50, 0.3)',
    },
  ];
  const offPodium = podium.filter((e) => e.rank > 3);
  return (
    <section aria-label="Il podio della serata" className={styles.podiumContainer}>
      <p className={styles.podiumTitle}>🏆 Il podio della serata</p>
      <div className={styles.podiumStage}>
        {steps.map(({ rank, medal, height, bg, border, glow }) => {
          const who = podium.filter((e) => e.rank === rank);
          if (who.length === 0) return <div key={rank} style={{ flex: 1 }} />;
          const totale = who[0].points;
          return (
            <div key={rank} className={styles.podiumPillar}>
              <span className={styles.podiumMedal}>{medal}</span>
              <span
                className={styles.podiumPlayerName}
                style={{ color: rank === 1 ? 'var(--gold)' : undefined }}
              >
                {who.map(name).join(' · ')}
              </span>
              <span className={styles.podiumScore}>
                {totale} {totale === 1 ? 'punto' : 'punti'}
              </span>
              <div
                className={styles.podiumBlock}
                style={{
                  minHeight: height,
                  background: bg,
                  border: `2px solid ${border}`,
                  borderBottom: 'none',
                  boxShadow: glow,
                }}
              >
                {rank}°
              </div>
            </div>
          );
        })}
      </div>
      {offPodium.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            width: 'min(92vw, 26rem)',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          {offPodium.map((e) => (
            <p
              key={e.player.id}
              style={{
                margin: 0,
                fontSize: '0.95rem',
                opacity: 0.9,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
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

const AWARD_ARCHETYPES: Record<string, string> = {
  persuasore: '⚡ Profilo Reale: Il Catalizzatore d’Impatto',
  banderuola: '⚖️ Profilo Reale: L’Equilibrista Strategico',
  roccione: '🛡️ Profilo Reale: La Roccia dei Principi',
  sintonia: '🔮 Profilo Reale: Il Lettore di Risonanze',
  bastian: '🦅 Profilo Reale: Il Dissidente Lucido',
  oratore: '🎙️ Profilo Reale: Il Maestro d’Arringa',
  oracolo: '👁️ Profilo Reale: Il Veggente dei Trend',
  voltagabbana: '🌪️ Profilo Reale: Il Pivot Tattico',
  sfinge: '🏛️ Profilo Reale: Il Filosofo Stoico',
};

/** The fun end-of-game superlatives (FINAL_AWARDS). */
export function AwardsPanel({ awards }: { awards: Award[] }) {
  if (awards.length === 0) {
    return <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>Grazie per aver giocato! 🎉</p>;
  }
  return (
    <>
      <Celebration pieces={45} />
      <CardGrid min={15} aria-label="Premi finali">
        {awards.map((a) => (
          <Card
            key={a.id}
            glow="accent"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 'clamp(2.4rem, 4vw, 3.6rem)' }}>{a.emoji}</span>
            <span style={{ fontSize: 'clamp(1.15rem, 2vw, 1.6rem)', fontWeight: 800 }}>{a.title}</span>
            <span style={{ fontSize: 'clamp(1.3rem, 2.4vw, 2rem)', fontWeight: 700, color: 'var(--gold)' }}>
              {a.winner.nickname}
            </span>
            <span style={{ fontSize: '0.95rem', opacity: 0.85 }}>{a.description}</span>
            {AWARD_ARCHETYPES[a.id] && (
              <span
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--gold-soft)',
                  border: '1px solid var(--gold-line)',
                  color: 'var(--gold)',
                  fontWeight: 800,
                  marginTop: '0.3rem',
                  letterSpacing: '0.02em',
                }}
              >
                {AWARD_ARCHETYPES[a.id]}
              </span>
            )}
          </Card>
        ))}
      </CardGrid>
    </>
  );
}
