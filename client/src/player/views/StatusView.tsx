import { useMemo, type ReactNode } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import {
  PHASE_LABELS,
  OBJECTIVE,
  SPLIT_REVEAL_WINDOW_S,
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
import { Card, Button, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, NamedMomentsPanel, PodiumPanel } from '../../shared/ui';
import { NORTHSTAR_URL } from '../../shared/northstar';
import { pickIronicTitle, WRONG_PREDICTION_TITLES, WRONG_SWING_BET_TITLES, WRONG_KNOW_TITLES } from '../../shared/ironicTitles';
import { wrap } from './layout';

interface StatusViewProps {
  phase: GameStatePayload['phase'];
  game: GameStatePayload | null;
  remaining: number | null;
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
  remaining,
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
  const narratorAdvance = (label: string) =>
    isLeader ? (
      <Button variant="primary" onClick={onAdvance}>
        {label}
      </Button>
    ) : (
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>{waitingMessage()}</p>
    );
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
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
            <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{game.storia.title}</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.85, margin: 0 }}>con {game.storia.protagonist}</p>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-serif)', textAlign: 'center' }}>
              {game.storia.premessa}
            </p>
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
              <p style={{ fontSize: '1.05rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-serif)', textAlign: 'center' }}>
                {game.storia.sceneNarration}
              </p>
            )}
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
              <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Il gruppo ha scelto {game.storia.decision === 'A' ? '🔵 A' : '🟠 B'}
              </p>
            )}
            {game.storia.consequence && (
              <p style={{ fontSize: '1.05rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-serif)', textAlign: 'center' }}>
                {game.storia.consequence}
              </p>
            )}
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
            <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Epilogo</p>
            {game.storia.epilogo && (
              <p style={{ fontSize: '1.05rem', lineHeight: 1.55, margin: 0, fontFamily: 'var(--font-serif)', textAlign: 'center' }}>
                {game.storia.epilogo}
              </p>
            )}
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
          <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
            Niente dibattito — nuovo dilemma in arrivo…
          </p>
        </>
      ) : phase === 'SPLIT_REVEAL' ? (
        remaining != null && remaining > SPLIT_REVEAL_WINDOW_S ? (
          <div
            aria-label="Si scopre il gruppo tra…"
            style={{ fontSize: 'clamp(4rem, 20vw, 8rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining - SPLIT_REVEAL_WINDOW_S}
          </div>
        ) : (
          <>
            {game?.split && <SplitBar split={game.split} />}
            {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
            <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>
              Ecco come si è diviso il gruppo — ora si difende
            </p>
          </>
        )
      ) : phase === 'PHASE_RESULTS' ? (
        <>
          {game?.swing && <ResultsPanel swing={game.swing} />}
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
              <SplitBar split={game.groupMindTally} />
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
      {skipButton}
    </main>
  );
}
