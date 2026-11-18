import { useMemo, type ReactNode } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import {
  PHASE_LABELS,
  OBJECTIVE,
  tappaMeta,
  DUO_ACT_META,
  type GameStatePayload,
  type BlindSpot,
  type PublicPlayer,
  type PlayerInfiltratoRolePayload,
  type PlayerPredictionResultPayload,
  type PlayerSwingBetResultPayload,
  type PlayerKnowGuessResultPayload,
  type PlayerGroupMindResultPayload,
} from '../../shared/events';
import { Card, Button, DilemmaCard, SplitBar, ResultsPanel, RilancioCard, AwardsPanel, NamedMomentsPanel, PodiumPanel, CompactAudioPlayer } from '../../shared/ui';
import { computeRealWorldArchetype, type PlayerVoteStats } from '../../shared/realworld/archetypes';
import { NORTHSTAR_URL } from '../../shared/northstar';
import { pickIronicTitle, WRONG_PREDICTION_TITLES, WRONG_SWING_BET_TITLES, WRONG_KNOW_TITLES } from '../../shared/ironicTitles';
import { wrap } from './layout';
import { narrationFor } from '../../host/audio/narrator';
import { getStoryAudioUrl } from '../../host/audio/storyAudioPlayer';

interface StatusViewProps {
  phase: GameStatePayload['phase'];
  game: GameStatePayload | null;
  remaining?: number | null;
  playerId: string | null;
  isLeader: boolean;
  players: PublicPlayer[];
  onAdvance: () => void;
  onRematch: () => void;
  infiltratoRole: PlayerInfiltratoRolePayload | null;
  predictionResult: PlayerPredictionResultPayload | null;
  swingBetResult: PlayerSwingBetResultPayload | null;
  knowResult: PlayerKnowGuessResultPayload | null;
  groupMindResult: PlayerGroupMindResultPayload | null;
  blindSpot: BlindSpot | null;
  skipButton: ReactNode;
}

// The phone's in-game "look at the shared screen" status display for every phase
// that isn't an interactive tap-to-act one: tappa intros/recaps, reveals, results,
// and the final awards (with the private blind-spot + sign-in-to-save nudge).
// Presentational: the parent owns the game state and the leader's advance emit.
export default function StatusView({
  phase,
  game,
  remaining: _remaining = null,
  playerId,
  isLeader,
  players,
  onAdvance,
  onRematch,
  infiltratoRole,
  predictionResult,
  swingBetResult,
  knowResult,
  groupMindResult,
  blindSpot,
  skipButton,
}: StatusViewProps) {
  // useAuth keeps the <Show when="signed-out"> gate working inside this view.
  useAuth();
  // A wrong guess gets a funny title instead of a flat X (2.4) — memoized on
  // the result's own identity so it doesn't re-roll on every re-render (the
  // countdown ticks every 250ms) and only changes for a genuinely new result.
  const wrongPredictionTitle = useMemo(() => pickIronicTitle(WRONG_PREDICTION_TITLES), [predictionResult]);
  const wrongSwingBetTitle = useMemo(() => pickIronicTitle(WRONG_SWING_BET_TITLES), [swingBetResult]);
  const wrongKnowTitle = useMemo(() => pickIronicTitle(WRONG_KNOW_TITLES), [knowResult]);
  const wrongGroupMindTitle = useMemo(() => pickIronicTitle(WRONG_KNOW_TITLES), [groupMindResult]);

  const personalArchetype = useMemo(() => {
    if (phase !== 'FINAL_AWARDS') return null;
    const myAward = game?.awards?.find((a) => a.winner.id === playerId);
    const s: PlayerVoteStats = {
      rounds: game?.dilemmaCount ?? 3,
      changedCount: myAward?.id === 'banderuola' ? 3 : myAward?.id === 'roccione' ? 0 : 1,
      majorityCount: myAward?.id === 'sintonia' ? 3 : 1,
      minorityCount: myAward?.id === 'bastian' ? 3 : 1,
      persuasion: myAward?.id === 'persuasore' ? 3 : 0,
      defendedCount: 1,
    };
    if (blindSpot) {
      if (blindSpot.id === 'volubile') s.changedCount = 3;
      if (blindSpot.id === 'rigido') s.changedCount = 0;
      if (blindSpot.id === 'conformista') s.majorityCount = 3;
      if (blindSpot.id === 'contrarian') s.minorityCount = 3;
    }
    return computeRealWorldArchetype(s);
  }, [phase, game?.awards, playerId, blindSpot, game?.dilemmaCount]);
  // Leader-paced beats (storia narration + the percorso tappa recap): the leader
  // advances; others wait. Named by nickname so the group knows WHO to nudge, and
  // reframed if that leader just dropped — leadership reassigns automatically on
  // disconnect (RECONNECT_GRACE_MS), so this is a transient "hang on" message, not
  // a stall: the story's own state (6.3) is untouched and resumes exactly where it
  // left off once a new leader's phone picks up the "Continua ▶" control.
  const currentLeader = players.find((p) => p.id === game?.leaderId) ?? null;
  const waitingMessage = (): ReactNode => {
    if (!currentLeader) return 'In attesa del leader…';
    if (currentLeader.connected === false) {
      return `🔌 ${currentLeader.nickname} si è disconnesso — passiamo il testimone a breve…`;
    }
    return `In attesa di ${currentLeader.nickname}…`;
  };

  const narrationLine = narrationFor(phase, game?.storia ?? null, game?.dilemma ?? null);
  const audioUrl = getStoryAudioUrl(phase, game?.storia ?? null, game?.dilemma ?? null);

  const speechButton = narrationLine ? (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
      <CompactAudioPlayer audioUrl={audioUrl} fallbackText={narrationLine} label="Ascolta" />
    </div>
  ) : null;

  const narratorAdvance = (label: string) =>
    isLeader ? (
      <Button variant="primary" onClick={onAdvance}>
        {label}
      </Button>
    ) : (
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>{waitingMessage()}</p>
    );
  return (
    <main style={{ ...wrap, paddingTop: 'max(3.5rem, env(safe-area-inset-top, 0px))' }}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>
      {phase === 'TAPPA_INTRO' ? (
        game?.percorso ? (() => {
          const meta = tappaMeta(game.percorso.currentTappa);
          return (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ fontSize: '3rem', margin: 0 }}>{meta.emoji}</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{meta.nome}</p>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>{meta.sottotitolo}</p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>{meta.descrizione}</p>
            </Card>
          );
        })() : null
      ) : phase === 'TAPPA_RECAP' ? (
        game?.percorso ? (() => {
          const p = game.percorso;
          const meta = tappaMeta(p.currentTappa);
          const isLast = p.dilemmaIndex >= p.totalDilemmas;
          return (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{meta.emoji} {meta.nome} — fatto!</p>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
                {p.tappaDilemmas} {p.tappaDilemmas === 1 ? 'dilemma' : 'dilemmi'} · {p.tappaSwings} {p.tappaSwings === 1 ? 'ribaltone' : 'ribaltoni'}
              </p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
                {isLast ? 'Avete raggiunto la vetta 🏔️' : 'Pausa: riprendete quando volete.'}
              </p>
              {narratorAdvance(isLast ? 'Vai ai premi ▶' : 'Continua ▶')}
            </Card>
          );
        })() : null
      ) : phase === 'STORY_INTRO' ? (
        game?.storia ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            <p style={{ fontSize: '2.6rem', margin: 0 }}>{game.storia.emoji}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0 }}>{game.storia.title}</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.85, margin: 0 }}>con {game.storia.protagonist}</p>
            <p style={{ fontSize: '1.02rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
              {game.storia.premessa}
            </p>
            {speechButton}
            {narratorAdvance('Comincia ▶')}
          </Card>
        ) : null
      ) : phase === 'SCENE_INTRO' ? (
        game?.storia ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            {game.storia.actTitle && (
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {game.storia.actTitle}
              </p>
            )}
            <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>
              Scena {game.storia.sceneIndex + 1} di {game.storia.totalScenes}
            </p>
            {game.storia.sceneNarration && (
              <p style={{ fontSize: '1.02rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
                {game.storia.sceneNarration}
              </p>
            )}
            {speechButton}
            {narratorAdvance('Al bivio ▶')}
          </Card>
        ) : null
      ) : phase === 'SCENE_CONSEQUENCE' ? (
        game?.storia ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            {game.storia.decision && (
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.08rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0 }}>
                {game.dilemma
                  ? game.storia.decision === 'A'
                    ? game.dilemma.optionA
                    : game.dilemma.optionB
                  : 'Scelta confermata'}
              </p>
            )}
            {game.storia.consequence && (
              <p style={{ fontSize: '1.02rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
                {game.storia.consequence}
              </p>
            )}
            {speechButton}
            {narratorAdvance('Continua ▶')}
          </Card>
        ) : null
      ) : phase === 'STORY_EPILOGUE' ? (
        game?.storia ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            <p style={{ fontSize: '2.2rem', margin: 0 }}>🌅</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0 }}>Epilogo</p>
            {game.storia.epilogo && (
              <p style={{ fontSize: '1.02rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
                {game.storia.epilogo}
              </p>
            )}
            {speechButton}
            {narratorAdvance('Vai ai premi ▶')}
          </Card>
        ) : null
      ) : phase === 'PHASE_INTRO' ? (
        <>
          {infiltratoRole && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>🕵️ Sei l'Infiltrato!</p>
              <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>{infiltratoRole.mission}</p>
            </Card>
          )}
          {(() => {
            const myTeam = game?.teams?.assignments.find((a) => a.playerId === playerId)?.team;
            return myTeam ? (
              <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                {myTeam === 'blu' ? '🔵 Sei nel Team Blu' : '🟠 Sei nel Team Arancio'}
              </p>
            ) : null;
          })()}
          <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, maxWidth: '22rem' }}>
            🎯 {OBJECTIVE}
          </p>
        </>
      ) : phase === 'DILEMMA_REVEAL' ? (
        <>
          {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
          <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
            Leggete insieme — tra poco si vota
          </p>
        </>
      ) : phase === 'UNANIMOUS_REVEAL' ? (
        <>
          <p style={{ fontSize: '3rem', margin: 0 }} aria-hidden>
            🎉
          </p>
          {game?.unanimous && game?.dilemma && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {game.unanimous.side === 'A' ? game.dilemma.optionA : game.dilemma.optionB}
              </p>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
                {game.unanimous.count} su {game.unanimous.count} dalla stessa parte
              </p>
            </Card>
          )}
          <RilancioCard domanda={game?.dilemma?.domandaRilancio} />
          <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
            Niente dibattito — nuovo dilemma in arrivo…
          </p>
        </>
      ) : phase === 'SPLIT_REVEAL' ? (
        game?.partyCard?.mode === 'infiltrato' && game.partyCard.infiltratoRoundResult ? (
          <Card
            glow={game.partyCard.infiltratoRoundResult.caught ? 'a' : 'accent'}
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'center' }}
          >
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: game.partyCard.infiltratoRoundResult.caught ? '#34d399' : '#f87171' }}>
              {game.partyCard.infiltratoRoundResult.caught
                ? "🎉 L'INFILTRATO È STATO SMASCHERATO!"
                : "😈 L'INFILTRATO L'HA FATTA FRANCA!"}
            </p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              🕵️ {game.partyCard.infiltratoRoundResult.infiltratorNickname}
            </p>
            <div style={{ textAlign: 'left', fontSize: '0.88rem', opacity: 0.92, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#34d399' }}>Gruppo:</strong> “{game.partyCard.infiltratoRoundResult.groupQuestion}”
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#f87171' }}>Infiltrato:</strong> “{game.partyCard.infiltratoRoundResult.impostorQuestion}”
              </p>
            </div>
          </Card>
        ) : game?.partyCard?.mode === 'flash' && game.partyCard.flashResult?.isEmpty ? (
          <p style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.85, margin: 0 }}>
            Nessun voto ricevuto in questo round.
          </p>
        ) : game?.partyCard?.mode === 'flash' && game.partyCard.flashResult ? (
          <>
            {game?.split && (
              <SplitBar
                split={game.split}
                optionA={game.dilemma?.optionA}
                optionB={game.dilemma?.optionB}
              />
            )}
            <p style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#fbbf24', maxWidth: '22rem' }}>
              {game.partyCard.flashResult.isUnanimous
                ? '🍻 Unanimità! Tutti dalla stessa parte!'
                : game.partyCard.flashResult.isTie
                  ? '⚔️ Guerra civile (50% vs 50%)! Difendetevi ora!'
                  : game.partyCard.flashResult.minorityNicknames.length > 0
                    ? `🍺 In minoranza: ${game.partyCard.flashResult.minorityNicknames.join(', ')} — tocca a voi difendervi!`
                    : 'Ecco come si è diviso il gruppo'}
            </p>
          </>
        ) : game?.partyCard?.mode === 'preferiresti' && game.partyCard.preferirestiResult ? (
          game.partyCard.preferirestiResult.isEmpty ? (
            <p style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.85, margin: 0 }}>
              Nessun voto ricevuto in questo round.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: 'min(90vw, 22rem)' }}>
                {game.partyCard.preferirestiResult.options.map((opt) => {
                  const isWin = game.partyCard?.preferirestiResult?.winningChoices.includes(opt.letter);
                  return (
                    <div
                      key={opt.letter}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isWin ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.06)',
                        border: isWin ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.14)',
                        textAlign: 'left',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                        <span>{opt.label}</span>
                        <span>{opt.count}</span>
                      </div>
                      {opt.voterNicknames.length > 0 && (
                        <div style={{ fontSize: '0.78rem', opacity: 0.78, marginTop: '0.15rem' }}>
                          {opt.voterNicknames.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#7dd3fc', maxWidth: '22rem' }}>
                {game.partyCard.preferirestiResult.isUnanimous
                  ? '🙌 Tutti sulla stessa scelta!'
                  : game.partyCard.preferirestiResult.isTie
                    ? '⚔️ Parità tra le scelte — se ne discute!'
                    : game.partyCard.preferirestiResult.minorityNicknames.length > 0
                      ? `🍺 In minoranza: ${game.partyCard.preferirestiResult.minorityNicknames.join(', ')} — difendete la vostra scelta!`
                      : 'Ecco come si è diviso il gruppo'}
              </p>
            </>
          )
        ) : game?.partyCard?.mode === 'assurdo' && game.partyCard.cardType === 'gogna' && game.partyCard.gognaTargetNickname ? (
          <Card style={{ width: 'min(90vw, 22rem)', padding: '0.9rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>
              👑 Alla gogna: {game.partyCard.gognaTargetNickname}!
            </p>
            {game.partyCard.sentenza && (
              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                📜 “{game.partyCard.sentenza}”
              </p>
            )}
          </Card>
        ) : (
          <>
            {game?.split && (
              <SplitBar
                split={game.split}
                optionA={game.dilemma?.optionA}
                optionB={game.dilemma?.optionB}
              />
            )}
            <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
              {game?.split && (game.split.A === 0 || game.split.B === 0)
                ? 'Tutti dalla stessa parte!'
                : game?.partyCard
                  ? 'Ecco come si è diviso il gruppo'
                  : 'Ecco come si è diviso il gruppo — ora si difende'}
            </p>
          </>
        )
      ) : phase === 'PHASE_RESULTS' ? (
        <>
          {game?.swing && <ResultsPanel swing={game.swing} dilemma={game?.dilemma} />}
          {game?.dilemmaAuthor && (
            <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Indovinate chi l'ha scritto… ✍️ <strong>{game.dilemmaAuthor}</strong>!
            </p>
          )}
          {predictionResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {predictionResult.actual == null
                ? '🔮 Pareggio: nessun pronostico vince.'
                : predictionResult.correct
                  ? '✅ Pronostico azzeccato!'
                  : wrongPredictionTitle}
            </p>
          )}
          {swingBetResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {swingBetResult.correct
                ? `🎰 Ribaltone ${swingBetResult.flipped ? 'sì' : 'no'}: scommessa vinta!`
                : wrongSwingBetTitle}
            </p>
          )}
          {knowResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {knowResult.correct ? '🔮 Conosci bene il tuo amico!' : wrongKnowTitle}
            </p>
          )}
        </>
      ) : phase === 'GROUP_MIND_REVEAL' ? (
        <>
          {game?.groupMindQuestion && game?.groupMindTally && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{game.groupMindQuestion.prompt}</p>
              <SplitBar
                split={game.groupMindTally}
                optionA={game.groupMindQuestion.optionA}
                optionB={game.groupMindQuestion.optionB}
              />
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                {game.groupMindTally.A} · {game.groupMindQuestion.optionA} — {game.groupMindQuestion.optionB} · {game.groupMindTally.B}
              </p>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                🔮 {game.groupMindTally.correctGuessers} {game.groupMindTally.correctGuessers === 1 ? 'ha letto' : 'hanno letto'} bene il gruppo
              </p>
            </Card>
          )}
          {groupMindResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {groupMindResult.actual == null
                ? '🔮 Pareggio: nessuna ipotesi vince.'
                : groupMindResult.correct
                  ? '✅ Hai letto bene il gruppo!'
                  : wrongGroupMindTitle}
            </p>
          )}
        </>
      ) : phase === 'WRITE_REVEAL' ? (
        <>
          {game?.writePrompt && (
            <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>{game.writePrompt.text}</p>
          )}
          {game?.writeReveal && game.writeReveal.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 24rem)' }}>
              {[...game.writeReveal]
                .sort((a, b) => b.votes - a.votes)
                .map((a, i) => (
                  <Card
                    key={a.id}
                    glow={i === 0 && a.votes > 0 ? 'accent' : undefined}
                    style={{ padding: 'var(--space-3)', textAlign: 'center' }}
                  >
                    <p style={{ margin: 0, fontSize: '1rem' }}>
                      {i === 0 && a.votes > 0 && '🏆 '}
                      {a.text}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                      {a.authorNickname} · {a.votes} {a.votes === 1 ? 'voto' : 'voti'}
                    </p>
                  </Card>
                ))}
            </div>
          )}
        </>
      ) : phase === 'FINAL_AWARDS' ? (
        <>
          {game?.teams && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', textAlign: 'center' }}
            >
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                🔵 {game.teams.scores.blu} — {game.teams.scores.arancio} 🟠
              </p>
              <p style={{ margin: 0, fontSize: '1rem', opacity: 0.95 }}>
                {game.teams.scores.blu === game.teams.scores.arancio
                  ? 'Pareggio fra le squadre!'
                  : game.teams.scores.blu > game.teams.scores.arancio
                    ? 'Vince il Team Blu! 🔵'
                    : 'Vince il Team Arancio! 🟠'}
              </p>
            </Card>
          )}
          {game?.infiltratoResult && (
            <Card
              glow={game.infiltratoResult.won ? 'a' : 'accent'}
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                🕵️ L'infiltrato era <strong>{game.infiltratoResult.infiltratorNickname}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '1rem', opacity: 0.95 }}>
                {game.infiltratoResult.won
                  ? `Ha vinto! Ha ribaltato ${game.infiltratoResult.flips} round senza farsi scoprire.`
                  : game.infiltratoResult.caught
                    ? 'Smascherato dal gruppo! 🎉'
                    : 'Non è riuscito nella missione.'}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
                🕵️ Il replay: ha seminato dubbi in {game.infiltratoResult.toolUses} round.
              </p>
            </Card>
          )}
          {game?.podium && game.podium.length > 0 && (
            <>
              {(() => {
                const me = game.podium.find((e) => e.player.id === playerId);
                return me ? (
                  <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    🏅 Il tuo posto: {me.rank}° · {me.points} {me.points === 1 ? 'punto' : 'punti'}
                  </p>
                ) : null;
              })()}
              <PodiumPanel podium={game.podium} meId={playerId} />
            </>
          )}
          {game?.namedMoments && <NamedMomentsPanel moments={game.namedMoments} />}
          {game?.awards && <AwardsPanel awards={game.awards} />}
          {personalArchetype && (
            <Card
              glow="accent"
              style={{
                width: 'min(90vw, 24rem)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  fontWeight: 800,
                }}
              >
                🌟 Il Tuo Archetipo nel Mondo Reale
              </div>
              <div style={{ fontSize: '2.5rem' }}>{personalArchetype.emoji}</div>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{personalArchetype.title}</h3>
              <p style={{ margin: 0, fontStyle: 'italic', opacity: 0.85, fontSize: '0.95rem' }}>
                {personalArchetype.motto}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                {personalArchetype.descrizione}
              </p>
              <div
                style={{
                  marginTop: '0.3rem',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--gold-soft)',
                  border: '1px solid var(--gold-line)',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                }}
              >
                💡 <strong>Lezione per la vita vera:</strong> {personalArchetype.insegnamentoReale}
              </div>
            </Card>
          )}
          <Card
            glow="a"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Questo era un gioco. ⚡</p>
            <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
              Vuoi decidere così sul serio — sulla tua carriera e la tua crescita?
            </p>
            <a
              href={NORTHSTAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: '0.2rem',
                fontWeight: 700,
                textDecoration: 'none',
                padding: '0.6rem 1.4rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--faction-a)',
                color: 'var(--bg)',
              }}
            >
              Scopri NorthStar →
            </a>
          </Card>
          {isLeader && (
            <Button variant="primary" onClick={onRematch} style={{ marginTop: '0.25rem' }}>
              Giocate ancora ▶
            </Button>
          )}
          {blindSpot && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🔭 Il tuo punto cieco</h3>
              <p style={{ margin: 0, fontWeight: 700 }}>{blindSpot.title}</p>
              <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>{blindSpot.advice}</p>
            </Card>
          )}
          <Show when="signed-out">
            <p style={{ fontSize: '1rem', opacity: 0.85, margin: '0.4rem 0 0' }}>
              Accedi per salvare i tuoi premi.
            </p>
            <SignInButton mode="modal" forceRedirectUrl="/casa" signUpForceRedirectUrl="/casa">
              <button
                type="button"
                style={{ marginTop: '0.5rem', fontWeight: 700, padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              >
                Accedi e salva
              </button>
            </SignInButton>
          </Show>
        </>
      ) : phase === 'DUO_ACT_INTRO' ? (
        (() => {
          const meta = DUO_ACT_META[game?.duoAct?.act ?? 1];
          return meta ? (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
            >
              <p style={{ fontSize: '3rem', margin: 0 }}>{meta.emoji}</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{meta.nome}</p>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>{meta.sottotitolo}</p>
            </Card>
          ) : null;
        })()
      ) : phase === 'DUO_SYNC_REVEAL' || phase === 'DUO_REVEAL' ? (
        <>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {game?.duoSyncReveal?.agreed ? "Siete d'accordo! 🤝" : "Non siete d'accordo — si discute"}
          </p>
          {game?.duoSyncReveal?.picks.map((p) => (
            <p key={p.id} style={{ fontSize: '1.05rem', margin: 0 }}>
              <strong>{p.nickname}</strong>: {p.choice}
            </p>
          ))}
          {phase === 'DUO_SYNC_REVEAL' &&
            game?.duoSyncReveal?.predictions
              .filter((p) => p.correct)
              .map((p) => (
                <p key={p.id} style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
                  🔮 <strong>{p.nickname}</strong> ci ha visto giusto (+1 «ti conosco»)
                </p>
              ))}
          {phase === 'DUO_REVEAL' && game?.duoSyncReveal?.agreed && (
            <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
              🎭 Twist: uno di voi diventa avvocato del diavolo…
            </p>
          )}
        </>
      ) : phase === 'DUO_ROUND_RESULT' ? (
        <>
          {game?.duoRoundResult?.convinced.map((c) => (
            <p key={c.convinced.id} style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {c.ribaltone ? '🎭 Ribaltone! ' : '🎯 '}
              <strong>{c.persuader.nickname}</strong> ha fatto cambiare idea a{' '}
              <strong>{c.convinced.nickname}</strong> (+2)
            </p>
          ))}
          {game?.duoRoundResult?.vacillare
            .filter((v) => v.received > 0)
            .map((v) => (
              <p key={v.id} style={{ fontSize: '1.05rem', margin: 0 }}>
                ✨ <strong>{v.nickname}</strong> ha fatto vacillare (+{v.received})
              </p>
            ))}
          {game?.duoRoundResult &&
            game.duoRoundResult.convinced.length === 0 &&
            game.duoRoundResult.vacillare.every((v) => v.received === 0) && (
              <p style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>
                Nessuno ha ceduto di un millimetro 🪨
              </p>
            )}
          {game?.duoRoundResult && (
            <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0 }}>
              {game.duoRoundResult.scores.map((s) => `${s.nickname} ${s.total}`).join(' · ')}
            </p>
          )}
        </>
      ) : (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
          Guarda lo schermo condiviso.
        </p>
      )}
      {phase !== 'FINAL_AWARDS' &&
        phase !== 'DUO_PORTRAIT' &&
        phase !== 'TAPPA_RECAP' &&
        phase !== 'STORY_INTRO' &&
        phase !== 'SCENE_INTRO' &&
        phase !== 'SCENE_CONSEQUENCE' &&
        phase !== 'STORY_EPILOGUE' &&
        narratorAdvance('Continua ▶')}
      {skipButton}
    </main>
  );
}
