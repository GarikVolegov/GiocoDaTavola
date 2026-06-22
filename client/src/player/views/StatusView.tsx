import type { ReactNode } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import {
  PHASE_LABELS,
  OBJECTIVE,
  tappaMeta,
  type GameStatePayload,
  type BlindSpot,
  type PlayerInfiltratoRolePayload,
  type PlayerPredictionResultPayload,
  type PlayerSwingBetResultPayload,
  type PlayerKnowGuessResultPayload,
} from '../../shared/events';
import { Card, Button, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel } from '../../shared/ui';
import { wrap } from './layout';

interface StatusViewProps {
  phase: GameStatePayload['phase'];
  game: GameStatePayload | null;
  remaining: number | null;
  playerId: string | null;
  isLeader: boolean;
  onAdvance: () => void;
  infiltratoRole: PlayerInfiltratoRolePayload | null;
  predictionResult: PlayerPredictionResultPayload | null;
  swingBetResult: PlayerSwingBetResultPayload | null;
  knowResult: PlayerKnowGuessResultPayload | null;
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
  onAdvance,
  infiltratoRole,
  predictionResult,
  swingBetResult,
  knowResult,
  blindSpot,
  skipButton,
}: StatusViewProps) {
  // useAuth keeps the <Show when="signed-out"> gate working inside this view.
  useAuth();
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
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'center' }}
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
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center' }}
            >
              <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{meta.emoji} {meta.nome} — fatto!</p>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
                {p.tappaDilemmas} {p.tappaDilemmas === 1 ? 'dilemma' : 'dilemmi'} · {p.tappaSwings} {p.tappaSwings === 1 ? 'ribaltone' : 'ribaltoni'}
              </p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
                {isLast ? 'Avete raggiunto la vetta 🏔️' : 'Pausa: riprendete quando volete.'}
              </p>
              {isLeader ? (
                <Button variant="primary" onClick={onAdvance}>
                  {isLast ? 'Vai ai premi ▶' : 'Continua ▶'}
                </Button>
              ) : (
                <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>In attesa del leader…</p>
              )}
            </Card>
          );
        })() : null
      ) : phase === 'PHASE_INTRO' ? (
        <>
          {infiltratoRole && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'center' }}
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
        game?.dilemma && <DilemmaCard dilemma={game.dilemma} />
      ) : phase === 'SPLIT_REVEAL' ? (
        <>
          {game?.split && <SplitBar split={game.split} />}
          {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
        </>
      ) : phase === 'PHASE_RESULTS' ? (
        <>
          {game?.swing && <ResultsPanel swing={game.swing} />}
          {predictionResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {predictionResult.actual == null
                ? '🔮 Pareggio: nessun pronostico vince.'
                : predictionResult.correct
                  ? '✅ Pronostico azzeccato!'
                  : '❌ Stavolta non ci hai preso.'}
            </p>
          )}
          {swingBetResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {swingBetResult.correct
                ? `🎰 Ribaltone ${swingBetResult.flipped ? 'sì' : 'no'}: scommessa vinta!`
                : '🎰 Scommessa sul ribaltone persa.'}
            </p>
          )}
          {knowResult && (
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {knowResult.correct ? '🔮 Conosci bene il tuo amico!' : '🔮 Stavolta non l’hai indovinato.'}
            </p>
          )}
        </>
      ) : phase === 'FINAL_AWARDS' ? (
        <>
          {game?.teams && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'center' }}
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
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'center' }}
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
            </Card>
          )}
          {game?.awards && <AwardsPanel awards={game.awards} />}
          {blindSpot && (
            <Card
              glow="accent"
              style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}
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
            <SignInButton mode="modal">
              <button
                type="button"
                style={{ marginTop: '0.5rem', fontWeight: 700, padding: '0.6rem 1.4rem', borderRadius: '0.7rem', cursor: 'pointer' }}
              >
                Accedi e salva
              </button>
            </SignInButton>
          </Show>
        </>
      ) : phase === 'FINAL_DUEL' ? (
        <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
          Guarda il risultato sullo schermo!
        </p>
      ) : (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
          Guarda lo schermo condiviso.
        </p>
      )}
      {skipButton}
    </main>
  );
}
