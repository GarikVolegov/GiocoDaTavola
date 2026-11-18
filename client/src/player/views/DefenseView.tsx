import type { ReactNode } from 'react';
import {
  PHASE_LABELS,
  type DefenseState,
  type PartyCardPayload,
  type PlayerSecretQuestionPayload,
  type Reaction,
  type Twist,
} from '../../shared/events';
import ReactionSwarm from '../../shared/ReactionSwarm';
import ReactionBar from './ReactionBar';
import { Button, Card } from '../../shared/ui';
import MobilePhaseShell from './MobilePhaseShell';
import { vibrateTick } from '../../shared/haptics';

interface DefenseDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface Applause {
  speakerId: string;
  nickname: string;
  tally: Partial<Record<Reaction, number>>;
}

interface DefenseViewProps {
  phase: 'DEFENSE' | 'INTERVENTI';
  defense: DefenseState | null;
  dilemma: DefenseDilemma | null | undefined;
  isDevilRound: boolean;
  absurdConstraint: string | null;
  twist: Twist | null;
  /** 3.1: Pubblico never intervenes — the raise-hand affordance is hidden for them. */
  isPubblico: boolean;
  /** 4.5: only this phone sees the sabotage button — nobody else knows who the infiltrator is. */
  isInfiltrator: boolean;
  infiltratoToolUsed: boolean;
  infiltratoToolError: string | null;
  onUseInfiltratoTool: () => void;
  playerId: string | null;
  handRaised: boolean;
  raiseHandError: string | null;
  canFinishNow?: boolean;
  minRemaining?: number | null;
  remaining?: number | null;
  readingRemaining?: number | null;
  isLeader?: boolean;
  onFinishReading?: () => void;
  speakerElapsed?: number | null;
  lastTurnApplause: Applause | null;
  onFinish: () => void;
  onToggleHand: () => void;
  onReact: (emoji: Reaction) => void;
  skipButton: ReactNode;
  partyCard?: PartyCardPayload | null;
  secretQuestion?: PlayerSecretQuestionPayload | null;
}

// The phone's defense/interventi turn screen. Presentational: the parent owns the
// raised-hand state, the turn timers, and the socket emits.
export default function DefenseView({
  phase,
  defense: d,
  dilemma,
  isDevilRound,
  absurdConstraint,
  twist,
  isPubblico,
  isInfiltrator,
  infiltratoToolUsed,
  infiltratoToolError,
  onUseInfiltratoTool,
  playerId,
  handRaised,
  raiseHandError,
  canFinishNow: _canFinishNow = true,
  minRemaining: _minRemaining = null,
  remaining: _remaining = null,
  readingRemaining: _readingRemaining = null,
  isLeader: _isLeader = false,
  onFinishReading: _onFinishReading,
  speakerElapsed: _speakerElapsed = null,
  lastTurnApplause,
  onFinish,
  onToggleHand,
  onReact,
  skipButton,
  partyCard,
  secretQuestion,
}: DefenseViewProps) {
  const speaker = d?.speaker ?? null; // the defender (DEFENSE only)
  const myTurn = d?.speakerId != null && d.speakerId === playerId;
  const sideOption = speaker
    ? speaker.side === 'A'
      ? dilemma?.optionA
      : dilemma?.optionB
    : undefined;
  const myQueuePos = d?.queue ? d.queue.findIndex((q) => q.id === playerId) : -1;

  const finishButton = (
    <Button variant="primary" size="lg" onClick={onFinish}>
      Ho finito ▶
    </Button>
  );

  const canRaiseHand =
    phase === 'DEFENSE' &&
    d?.speakerId != null &&
    !isPubblico &&
    twist?.id !== 'interventi-vietati' &&
    twist?.id !== 'duello-botta-risposta';

  const dock = myTurn ? (
    <>
      {finishButton}
      {skipButton}
    </>
  ) : (
    <>
      {canRaiseHand && (
        <>
          <button
            type="button"
            onClick={() => {
              vibrateTick();
              onToggleHand();
            }}
            aria-pressed={handRaised}
            style={{
              width: '100%',
              minHeight: '3rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              padding: '0.75rem 1.4rem',
              borderRadius: 'var(--radius-pill)',
              border: handRaised ? '2px solid var(--gold)' : '2px solid var(--border-strong)',
              background: handRaised ? 'var(--gold-soft)' : 'rgba(255, 255, 255, 0.06)',
              color: 'inherit',
              cursor: 'pointer',
              transition: 'all var(--dur-fast) var(--ease-spring)',
              boxShadow: handRaised ? 'var(--glow-accent)' : 'none',
            }}
          >
            {handRaised ? '✋ Abbassa la mano' : '✋ Alza la mano'}
          </button>
          <p style={{ fontSize: '0.85rem', opacity: 0.72, margin: 0 }}>
            {raiseHandError
              ? raiseHandError
              : handRaised
                ? '✋ Mano alzata — potrai intervenire dopo le difese'
                : 'Alza la mano per intervenire dopo'}
          </p>
        </>
      )}
      <ReactionBar onReact={(emoji) => { vibrateTick(); onReact(emoji); }} />
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={PHASE_LABELS[phase]} dock={dock}>
      <ReactionSwarm />
      {lastTurnApplause && (
        <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
          {lastTurnApplause.nickname}:{' '}
          {Object.entries(lastTurnApplause.tally)
            .map(([emoji, count]) => `${emoji}×${count}`)
            .join(' ')}
        </p>
      )}

      {myTurn ? (
        <>
          {phase === 'INTERVENTI' ? (
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te: intervieni! 🙋</p>
          ) : speaker?.devil ? (
            <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--gold)' }}>
              🎭 Avvocato del Diavolo!
            </p>
          ) : (
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
          )}

          {phase === 'DEFENSE' && speaker && (
            <Card
              glow={speaker.devil ? 'accent' : speaker.side === 'A' ? 'a' : 'b'}
              style={{
                width: 'min(90vw, 24rem)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-4)',
              }}
            >
              {dilemma && (
                <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
                  {dilemma.text}
                </p>
              )}
              {speaker.devil ? (
                <p style={{ fontSize: '1.1rem', opacity: 0.95, margin: 0, maxWidth: '22rem' }}>
                  Hai votato diversamente, ma ora convinci tutti
                  che <strong>{sideOption ?? 'questa'}</strong> è la scelta giusta!
                </p>
              ) : (
                <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
                  Difendi: <strong>{sideOption ?? 'la tua posizione'}</strong>
                </p>
              )}
              {absurdConstraint && (
                <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem', color: 'var(--gold)' }}>
                  🎭 Vincolo: {absurdConstraint}
                </p>
              )}
              {twist && (
                <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem', color: 'var(--gold)' }}>
                  {twist.label}: {twist.description}
                </p>
              )}
              {d?.spunti && d.spunti.length > 0 && (
                <div style={{ width: '100%', textAlign: 'center', marginTop: 'var(--space-2)' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.8, margin: '0 0 0.3rem' }}>
                    Spunti per te:
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {d.spunti.map((s, i) => (
                      <li key={`${i}-${s}`} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </>
      ) : speaker == null && phase === 'DEFENSE' && partyCard?.mode === 'infiltrato' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: 'min(90vw, 22rem)' }}>
          {secretQuestion ? (
            <div
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: secretQuestion.isInfiltrator
                  ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.25) 0%, rgba(30, 20, 20, 0.85) 100%)'
                  : 'linear-gradient(145deg, rgba(16, 185, 129, 0.25) 0%, rgba(15, 30, 25, 0.85) 100%)',
                border: secretQuestion.isInfiltrator ? '2px solid #ef4444' : '2px solid #10b981',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                boxShadow: secretQuestion.isInfiltrator
                  ? '0 0 20px rgba(239, 68, 68, 0.45)'
                  : '0 0 20px rgba(16, 185, 129, 0.35)',
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: secretQuestion.isInfiltrator ? '#ef4444' : '#10b981',
                  letterSpacing: '0.05em',
                }}
              >
                {secretQuestion.isInfiltrator ? '🕵️ SEI L’INFILTRATO!' : '🤫 LA TUA DOMANDA SEGRETA'}
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#fff', lineHeight: 1.25 }}>
                {secretQuestion.question}
              </p>
              <span style={{ fontSize: '0.82rem', opacity: 0.88 }}>
                {secretQuestion.isInfiltrator
                  ? 'Rispondi al volo a voce e confondi il tavolo senza farti scoprire!'
                  : 'Rispondete a voce a turno, poi interrogatevi per capire chi ha la domanda diversa!'}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>
              🕵️ Rispondete a voce alla domanda segreta e interrogatevi: chi è l’Infiltrato?
            </p>
          )}
        </div>
      ) : speaker == null && phase === 'DEFENSE' && partyCard?.mode === 'flash' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', maxWidth: '22rem', textAlign: 'center' }}>
          {dilemma && (
            <Card style={{ width: '100%', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{dilemma.text}</p>
              <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.8 }}>
                {dilemma.optionA} · {dilemma.optionB}
              </p>
            </Card>
          )}
          <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--gold)' }}>
            ⚡ Difesa Lampo!
          </p>
          <p style={{ fontSize: '0.98rem', opacity: 0.92, margin: 0 }}>
            {partyCard.flashResult?.isTie
              ? '⚔️ Guerra civile (50/50) — attacco e difesa dal vivo!'
              : partyCard.flashResult?.minorityNicknames.length
                ? `🍺 In minoranza: ${partyCard.flashResult.minorityNicknames.join(', ')} — difendetevi dal vivo!`
                : 'La minoranza difende la propria scelta dal vivo!'}
          </p>
        </div>
      ) : speaker == null && phase === 'DEFENSE' && partyCard?.mode === 'preferiresti' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', maxWidth: '22rem', textAlign: 'center' }}>
          <Card style={{ width: '100%', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{partyCard.prompt}</p>
            {partyCard.options && partyCard.options.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left', fontSize: '0.82rem', opacity: 0.85 }}>
                {partyCard.options.slice(0, 4).map((opt, idx) => (
                  <div key={idx}>• {opt}</div>
                ))}
              </div>
            )}
          </Card>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#7dd3fc' }}>
            🔀 Difesa delle scelte!
          </p>
          <p style={{ fontSize: '0.98rem', opacity: 0.92, margin: 0 }}>
            {partyCard.preferirestiResult?.isTie
              ? '⚔️ Parità tra le scelte — convincete gli altri dal vivo!'
              : partyCard.preferirestiResult?.minorityNicknames.length
                ? `🍺 In minoranza: ${partyCard.preferirestiResult.minorityNicknames.join(', ')} — difendete la vostra scelta!`
                : 'Difendete la vostra scelta dal vivo!'}
          </p>
        </div>
      ) : speaker == null && phase === 'DEFENSE' && partyCard?.mode === 'assurdo' && partyCard.gognaTargetNickname ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', maxWidth: '22rem', textAlign: 'center' }}>
          <Card style={{ width: '100%', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.85 }}>
              {dilemma?.text ?? partyCard.prompt}
            </p>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
              👑 Alla gogna: {partyCard.gognaTargetNickname}
            </p>
            {partyCard.sentenza && (
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fde68a' }}>
                📜 “{partyCard.sentenza}”
              </p>
            )}
          </Card>
          <p style={{ fontSize: '0.98rem', fontWeight: 700, color: '#34d399', margin: 0 }}>
            Difenditi davanti a tutti prima di scontare la sentenza!
          </p>
        </div>
      ) : speaker == null && phase === 'DEFENSE' ? (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
          Nessuna difesa per questo dilemma.
        </p>
      ) : (
        <>
          {phase === 'DEFENSE' && isDevilRound && (
            <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--gold)' }}>
              🎭 Round Avvocato del Diavolo — difende il contrario!
            </p>
          )}
          {phase === 'DEFENSE' && absurdConstraint && (
            <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--gold)' }}>
              🎭 Vincolo: {absurdConstraint}
            </p>
          )}
          {phase === 'DEFENSE' && twist && (
            <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--gold)' }}>
              {twist.label}: {twist.description}
            </p>
          )}
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            {phase === 'INTERVENTI' ? (
              <>Interviene <strong>{d?.intervenor?.nickname ?? '…'}</strong> 🙋</>
            ) : (
              <>Sta parlando <strong>{speaker?.nickname ?? '…'}</strong> 🎤</>
            )}
          </p>

          {phase === 'DEFENSE' && speaker && (
            <>
              {dilemma && (
                <p style={{ fontSize: '0.95rem', opacity: 0.75, margin: 0, maxWidth: '22rem' }}>
                  {dilemma.text}
                </p>
              )}
              <p style={{ fontSize: '1rem', opacity: 0.9, margin: 0 }}>
                Sta difendendo: <strong>{sideOption ?? 'la sua posizione'}</strong>
              </p>
            </>
          )}

          {phase === 'INTERVENTI' && myQueuePos >= 0 && (
            <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0 }}>
              Sei in coda: {myQueuePos + 1}º
            </p>
          )}

          {phase === 'DEFENSE' && isInfiltrator && d?.speakerId != null && (
            <>
              <button
                type="button"
                onClick={onUseInfiltratoTool}
                disabled={infiltratoToolUsed}
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  padding: '0.6rem 1.1rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--gold)',
                  background: infiltratoToolUsed ? 'transparent' : 'var(--gold-soft)',
                  color: 'inherit',
                  cursor: infiltratoToolUsed ? 'default' : 'pointer',
                  opacity: infiltratoToolUsed ? 0.5 : 1,
                }}
              >
                🕵️ Semina un dubbio
              </button>
              <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>
                {infiltratoToolError
                  ? infiltratoToolError
                  : infiltratoToolUsed
                    ? 'Dubbio seminato per questo round.'
                    : 'Aggiunge un consiglio-esca ai suoi spunti — una volta per round.'}
              </p>
            </>
          )}
        </>
      )}
    </MobilePhaseShell>
  );
}
