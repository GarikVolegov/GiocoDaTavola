import { useMemo, useState } from 'react';
import { Button, Card, Celebration } from '../shared/ui';
import type { PassMode } from './fallbackDeck';
import {
  computePassFinaleSummary,
  type PassRoundHighlight,
  type PassState,
} from './passAndPlayEngine';
import styles from './PassFinaleView.module.css';

type FinaleTab = 'premi' | 'pagelle' | 'momenti';

const MODE_LABELS: Record<PassMode, string> = {
  flash: '⚡ Flash',
  infiltrato: '🕵️ L’Infiltrato',
  assurdo: '🤪 Assurdo',
  coppie: '🔥 Coppie',
  cruciverba: '🧩 Cruciverba Show',
  tribunale: '⚖️ Tribunale',
  preferiresti: '🔀 Preferiresti',
  mix: '🎲 Serata Mix',
  classico: '🎭 Classico',
  percorso: '🧗 Percorso',
  storia: '📖 Storie',
};

const TONE_CLASS: Record<PassRoundHighlight['momentBadge']['tone'], string> = {
  gold: styles.tone_gold,
  a: styles.tone_a,
  b: styles.tone_b,
  danger: styles.tone_danger,
  success: styles.tone_success,
};

export interface PassFinaleViewProps {
  state: PassState;
  recordSavedCode: string | null;
  onReplay: () => void;
  onHome: () => void;
}

export default function PassFinaleView({
  state,
  recordSavedCode,
  onReplay,
  onHome,
}: PassFinaleViewProps) {
  const summary = useMemo(() => computePassFinaleSummary(state), [state]);
  const [activeTab, setActiveTab] = useState<FinaleTab>('premi');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    () => summary.playerProfiles[0]?.player.id ?? '',
  );
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const playerName = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? 'Amico';

  const selectedProfileIndex = Math.max(
    0,
    summary.playerProfiles.findIndex((p) => p.player.id === selectedPlayerId),
  );
  const selectedProfile = summary.playerProfiles[selectedProfileIndex] ?? summary.playerProfiles[0];
  const nextProfile =
    summary.playerProfiles.length > 1
      ? summary.playerProfiles[(selectedProfileIndex + 1) % summary.playerProfiles.length]
      : null;

  const secondaryAwards = summary.mvp
    ? summary.awards.filter(
        (a) => !(a.id === summary.mvp?.id && a.winnerId === summary.mvp?.winnerId),
      )
    : summary.awards;

  const currentChallenge =
    summary.closingChallenges[challengeIndex % Math.max(1, summary.closingChallenges.length)] ??
    '🥂 Brindisi finale al tavolo!';

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: `Schierati — ${summary.verdict.title}`,
          text: summary.shareText,
        });
        return;
      }
    } catch {
      // Fallback to clipboard if user cancels or share fails
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary.shareText);
        setShareState('copied');
        window.setTimeout(() => setShareState('idle'), 2400);
      }
    } catch {
      // Ignore clipboard permission errors in restricted contexts
    }
  };

  const isSolo = summary.verdict.playerCount === 1;

  const renderMomentOutcome = (m: PassRoundHighlight): string => {
    if (m.soloMode && (m.kind === 'split' || m.kind === 'swing' || m.kind === 'dignita')) {
      const pct = m.crowdPctForChoice ?? 50;
      const tag = m.soloFlipped
        ? '🦋 Ribaltata'
        : pct >= 55
          ? '🎯 In Sintonia'
          : pct <= 45
            ? '⚡ Controcorrente'
            : '⚖️ Sul Filo';
      return `${m.liveVerdictLabel ?? 'La tua scelta'} · ${tag} (${pct}%)`;
    }
    if (m.kind === 'split' || m.kind === 'swing' || m.kind === 'dignita') {
      return m.liveVerdictLabel ?? 'Scelta condivisa al tavolo';
    }
    if (m.kind === 'coppie_align') {
      return m.coppieMatched
        ? `Sintonia! (${m.countA}/${m.countA + m.countB} coppie)`
        : 'Scintille al tavolo!';
    }
    if (m.kind === 'infiltrato') {
      const infName = m.infiltratoId ? playerName(m.infiltratoId) : '—';
      return m.infiltratoCaught
        ? `Infiltrato: ${infName} · Smascherato`
        : `Infiltrato: ${infName} · Ha vinto il bluff`;
    }
    if (m.kind === 'gogna') {
      const targets = (m.gognaWinnerIds ?? []).map(playerName).join(' & ') || 'Pareggio al tavolo';
      return `Alla gogna: ${targets}`;
    }
    if (m.kind === 'cruciverba') {
      return `Cruciverba: ${m.cruciverbaSolvedCount ?? 0}/${m.cruciverbaTotalCount ?? 4} parole risolte`;
    }
    if (m.kind === 'tribunale') {
      if (m.tribunaleWinnerIds && m.tribunaleWinnerIds.length === 1) {
        return `Vittoria di ${playerName(m.tribunaleWinnerIds[0])}`;
      }
      return 'Patteggiamento in aula';
    }
    return m.liveVerdictLabel ?? 'Sfida completata dal vivo';
  };

  return (
    <div className={styles.root}>
      <Celebration pieces={45} />

      {/* HERO VERDICT */}
      <Card glow="accent" className={styles.verdictCard}>
        <div className={styles.verdictTopRow}>
          <span className={styles.eyebrow}>
            {isSolo
              ? `🧭 Specchio Decisionale · ${MODE_LABELS[state.mode]}`
              : `Gran Finale · ${MODE_LABELS[state.mode]}`}
          </span>
          {recordSavedCode && (
            <span className={styles.savedChip}>
              ✓ Salvata · {recordSavedCode}
            </span>
          )}
        </div>

        <div className={styles.verdictHeader}>
          <div className={styles.verdictEmoji} aria-hidden="true">
            {summary.verdict.emoji}
          </div>
          <h2 className={styles.verdictTitle}>{summary.verdict.title}</h2>
          <p className={styles.verdictSubtitle}>{summary.verdict.subtitle}</p>
        </div>

        <div className={styles.meterBlock}>
          <div className={styles.meterHeader}>
            <span className={styles.meterLabel}>
              {isSolo ? 'La Tua Bussola vs Il Mondo' : 'Termometro del Tavolo'}
            </span>
            <span className={styles.meterValue}>{summary.verdict.chemistryLabel}</span>
          </div>
          <div
            className={styles.meterTrack}
            role="progressbar"
            aria-valuenow={summary.verdict.chemistryPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={isSolo ? 'Indice di sintonia personale' : 'Indice di sintonia del tavolo'}
          >
            <div
              className={styles.meterFill}
              style={{ width: `${Math.max(8, summary.verdict.chemistryPct)}%` }}
            />
          </div>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpiBox}>
            <span className={styles.kpiNum}>{summary.verdict.roundsPlayed}</span>
            <span className={styles.kpiLabel}>Round</span>
          </div>
          <div className={styles.kpiBox}>
            <span className={styles.kpiNum}>{isSolo ? 'Solo' : summary.verdict.playerCount}</span>
            <span className={styles.kpiLabel}>{isSolo ? 'Modalità' : 'Amici'}</span>
          </div>
          <div className={styles.kpiBox}>
            <span className={styles.kpiNum}>{summary.verdict.consensusCount}</span>
            <span className={styles.kpiLabel}>{isSolo ? 'In Sintonia' : 'Intese'}</span>
          </div>
          <div className={styles.kpiBox}>
            <span className={styles.kpiNum}>{summary.verdict.sparksCount}</span>
            <span className={styles.kpiLabel}>{isSolo ? 'Controcorrente' : 'Scintille'}</span>
          </div>
        </div>
      </Card>

      {/* INTERACTIVE SECTION TABS */}
      <div className={styles.tabsBar} role="tablist" aria-label="Dettagli della serata">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'premi'}
          className={`${styles.tabBtn} ${activeTab === 'premi' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('premi')}
        >
          <span>{isSolo ? '🎭' : '🏆'}</span>
          <span>{isSolo ? `Profilo (${summary.awards.length})` : `Premi (${summary.awards.length})`}</span>
        </button>
        {!isSolo && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pagelle'}
            className={`${styles.tabBtn} ${activeTab === 'pagelle' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('pagelle')}
          >
            <span>🪪</span>
            <span>Pagelle ({summary.playerProfiles.length})</span>
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'momenti'}
          className={`${styles.tabBtn} ${activeTab === 'momenti' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('momenti')}
        >
          <span>✨</span>
          <span>Momenti ({summary.moments.length})</span>
        </button>
      </div>

      {/* TAB 1: PREMI & SFIDA DELLA STAFFA (O PROFILO COMPLETO IN SOLO) */}
      {activeTab === 'premi' && (
        <div className={styles.tabPanel}>
          {isSolo && selectedProfile && (
            <Card glow="accent" className={styles.dossierCard}>
              <div className={styles.dossierHead}>
                <div className={styles.dossierAvatar}>
                  <span>{selectedProfile.player.avatar}</span>
                </div>
                <div>
                  <div className={styles.dossierPlayerName}>
                    🎭 Il Tuo Archetipo Decisionale
                  </div>
                  <h3 className={styles.dossierTitle}>
                    {selectedProfile.emoji} {selectedProfile.title}
                  </h3>
                </div>
              </div>

              <p className={styles.dossierMotto}>{selectedProfile.motto}</p>
              <p className={styles.dossierDesc}>{selectedProfile.description}</p>

              <div className={styles.dossierStatsGrid}>
                {selectedProfile.statPills.map((st) => (
                  <div key={st.label} className={styles.dossierStatBox}>
                    <span className={styles.dossierStatVal}>{st.value}</span>
                    <span className={styles.dossierStatLbl}>{st.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.lessonBox}>
                💡 <strong>Nella vita vera:</strong> {selectedProfile.lesson}
              </div>
            </Card>
          )}

          {summary.mvp && (
            <Card glow="accent" className={styles.mvpCard}>
              <span className={styles.mvpBadge}>
                {isSolo ? '🧭 Il Tuo Tratto Dominante' : '👑 Protagonista della Serata'}
              </span>
              <div className={styles.mvpAvatarWrap}>
                <span>{summary.mvp.winnerAvatar ?? '🏆'}</span>
                <span className={styles.mvpAwardBadge} aria-hidden="true">
                  {summary.mvp.emoji}
                </span>
              </div>
              <h3 className={styles.mvpTitle}>{summary.mvp.title}</h3>
              <div className={styles.mvpWinner}>{summary.mvp.winnerName}</div>
              <p className={styles.mvpDesc}>{summary.mvp.description}</p>
            </Card>
          )}

          {secondaryAwards.length > 0 && (
            <div className={styles.awardsGrid}>
              {secondaryAwards.map((aw) => (
                <div key={`${aw.id}-${aw.winnerId}`} className={styles.awardCard}>
                  <div className={styles.awardIconCol}>
                    <span>{aw.winnerAvatar ?? aw.emoji}</span>
                    <span className={styles.awardMiniEmoji} aria-hidden="true">
                      {aw.emoji}
                    </span>
                  </div>
                  <div className={styles.awardBody}>
                    <div className={styles.awardTitle}>{aw.title}</div>
                    <div className={styles.awardWinner}>{aw.winnerName}</div>
                    <div className={styles.awardDesc}>{aw.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.closerCard}>
            <div className={styles.closerTop}>
              <span className={styles.closerKicker}>
                {isSolo ? '💭 Il Tuo Spunto Finale' : '🥂 Sfida della Staffa'}
              </span>
              {summary.closingChallenges.length > 1 && (
                <button
                  type="button"
                  className={styles.closerNextBtn}
                  onClick={() => setChallengeIndex((i) => i + 1)}
                >
                  {isSolo ? 'Altro spunto 🎲' : 'Estrai un’altra 🎲'}
                </button>
              )}
            </div>
            <p className={styles.closerText}>{currentChallenge}</p>
          </div>
        </div>
      )}

      {/* TAB 2: PAGELLE & ARCHETIPI DEL TAVOLO */}
      {activeTab === 'pagelle' && selectedProfile && (
        <div className={styles.tabPanel}>
          <div className={styles.playerSelector} aria-label="Seleziona giocatore">
            {summary.playerProfiles.map((prof) => {
              const isSelected = prof.player.id === selectedProfile.player.id;
              return (
                <button
                  key={prof.player.id}
                  type="button"
                  className={`${styles.playerChip} ${isSelected ? styles.playerChipActive : ''}`}
                  onClick={() => setSelectedPlayerId(prof.player.id)}
                >
                  <span>{prof.player.avatar}</span>
                  <span>{prof.player.name}</span>
                </button>
              );
            })}
          </div>

          <Card glow="accent" className={styles.dossierCard}>
            <div className={styles.dossierHead}>
              <div className={styles.dossierAvatar}>
                <span>{selectedProfile.player.avatar}</span>
              </div>
              <div>
                <div className={styles.dossierPlayerName}>
                  {selectedProfile.player.name}
                </div>
                <h3 className={styles.dossierTitle}>
                  {selectedProfile.emoji} {selectedProfile.title}
                </h3>
              </div>
            </div>

            <p className={styles.dossierMotto}>{selectedProfile.motto}</p>
            <p className={styles.dossierDesc}>{selectedProfile.description}</p>

            <div className={styles.dossierStatsGrid}>
              {selectedProfile.statPills.map((st) => (
                <div key={st.label} className={styles.dossierStatBox}>
                  <span className={styles.dossierStatVal}>{st.value}</span>
                  <span className={styles.dossierStatLbl}>{st.label}</span>
                </div>
              ))}
            </div>

            {selectedProfile.awardsWon.length > 0 && (
              <div className={styles.dossierAwardsRow}>
                {selectedProfile.awardsWon.map((aw) => (
                  <span key={`${aw.id}-${aw.winnerId}`} className={styles.dossierAwardTag}>
                    {aw.emoji} {aw.title}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.lessonBox}>
              💡 <strong>Nella vita vera:</strong> {selectedProfile.lesson}
            </div>

            {nextProfile && (
              <Button
                variant="ghost"
                onClick={() => setSelectedPlayerId(nextProfile.player.id)}
              >
                Pagella di {nextProfile.player.avatar} {nextProfile.player.name} ▶
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: I MOMENTI DELLA SERATA */}
      {activeTab === 'momenti' && (
        <div className={styles.tabPanel}>
          {summary.moments.length === 0 ? (
            <Card className={styles.momentCard}>
              <p className={styles.momentPrompt} style={{ textAlign: 'center' }}>
                Avete chiuso una partita lampo! Rigiocate un giro per sbloccare la cronaca completa dei round.
              </p>
            </Card>
          ) : (
            <div className={styles.momentsList}>
              {summary.moments.map((m) => (
                <div key={`${m.roundIndex}-${m.cardId}`} className={styles.momentCard}>
                  <div className={styles.momentHeader}>
                    <span className={styles.momentRoundMeta}>
                      Round {m.roundIndex + 1} · {MODE_LABELS[m.cardMode]}
                    </span>
                    <span className={`${styles.momentBadge} ${TONE_CLASS[m.momentBadge.tone]}`}>
                      {m.momentBadge.emoji} {m.momentBadge.label}
                    </span>
                  </div>
                  <p className={styles.momentPrompt}>{m.prompt}</p>
                  <div className={styles.momentOutcome}>
                    <span>{renderMomentOutcome(m)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTION DOCK */}
      <div className={styles.actionDock}>
        <Button variant="primary" size="lg" onClick={onReplay}>
          {isSolo ? 'Nuova Partita 🔄' : 'Rigioca con gli stessi amici 🔄'}
        </Button>
        <div className={styles.secondaryActions}>
          <Button variant="ghost" onClick={() => void handleShare()}>
            {shareState === 'copied' ? '✓ Verdetto copiato!' : 'Condividi Verdetto 📤'}
          </Button>
          <Button variant="ghost" onClick={onHome}>
            Torna alla Home
          </Button>
        </div>
      </div>
    </div>
  );
}
