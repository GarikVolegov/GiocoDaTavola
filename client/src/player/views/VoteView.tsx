import { type ReactNode } from 'react';
import {
  PHASE_LABELS,
  PREFERIRESTI_CHOICES,
  type VoteChoice,
  type PreferirestiChoice,
  type PartyCardPayload,
  type PlayerSecretQuestionPayload,
  type SoloFeedbackPayload,
} from '../../shared/events';
import { Button, VoteOption, Alert, CompactAudioPlayer } from '../../shared/ui';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';
import { getStoryAudioUrl } from '../../host/audio/storyAudioPlayer';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';

type VotePhase = 'VOTE_1' | 'VOTE_2' | 'DUO_SIDE_PICK' | 'DUO_PICK' | 'DUO_REPICK';

interface VoteDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface VoteViewProps {
  phase: VotePhase;
  dilemma: VoteDilemma | null | undefined;
  remaining?: number | null;
  vote: VoteChoice | PreferirestiChoice | null;
  voteError: string | null;
  onVote: (choice: VoteChoice | PreferirestiChoice) => void;
  onConfirm: () => void;
  confirmed: boolean;
  votedCount: number;
  confirmedCount: number;
  playerCount: number;
  missingVoters: string[] | null;
  skipButton: ReactNode;
  partyCard?: PartyCardPayload | null;
  secretQuestion?: PlayerSecretQuestionPayload | null;
  gognaVotedTarget?: string | null;
  onGognaVote?: (targetId: string) => void;
  players?: { id: string; nickname: string }[];
  myPlayerId?: string | null;
  lastSoloFeedback?: SoloFeedbackPayload | null;
}

export default function VoteView({
  phase,
  dilemma,
  remaining: _remaining = null,
  vote,
  voteError,
  onVote,
  onConfirm,
  confirmed,
  votedCount,
  confirmedCount,
  playerCount,
  missingVoters,
  skipButton,
  partyCard,
  secretQuestion,
  gognaVotedTarget,
  onGognaVote,
  players,
  myPlayerId,
  lastSoloFeedback = null,
}: VoteViewProps) {
  const isCastPhase = phase === 'VOTE_1' || phase === 'DUO_SIDE_PICK' || phase === 'DUO_PICK';
  const isConfirmPhase = phase === 'VOTE_2' || phase === 'DUO_REPICK';
  const isSolo = playerCount === 1;

  const isFlash = partyCard?.mode === 'flash';
  const isPreferiresti = partyCard?.mode === 'preferiresti';

  const myCouple =
    partyCard?.mode === 'coppie' && myPlayerId
      ? partyCard.couples?.find(
          (c) => c.memberAId === myPlayerId || c.memberBId === myPlayerId,
        ) ?? null
      : null;
  const partnerName =
    myCouple && myPlayerId
      ? myCouple.memberAId === myPlayerId
        ? myCouple.memberBName
        : myCouple.memberAName
      : null;
  const resolvedOptionA =
    partyCard?.mode === 'coppie'
      ? partyCard.optionA ??
        (partyCard.cardType === 'allineamento' && myCouple
          ? myCouple.memberAName
          : partyCard.cardType !== 'allineamento'
            ? '✅ Fatta insieme!'
            : dilemma?.optionA ?? 'Prima scelta')
      : dilemma?.optionA ?? 'Prima scelta';
  const resolvedOptionB =
    partyCard?.mode === 'coppie'
      ? partyCard.optionB ??
        (partyCard.cardType === 'allineamento' && myCouple
          ? myCouple.memberBName
          : partyCard.cardType !== 'allineamento'
            ? '🍺 Penitenza / Passiamo'
            : dilemma?.optionB ?? 'Seconda scelta')
      : dilemma?.optionB ?? 'Seconda scelta';

  const preferirestiOptions = isPreferiresti
    ? (partyCard?.options?.length
        ? partyCard.options
        : [
            partyCard?.optionA ?? dilemma?.optionA ?? 'Prima scelta',
            partyCard?.optionB ?? dilemma?.optionB ?? 'Seconda scelta',
            partyCard?.optionC ?? 'Terza scelta',
            partyCard?.optionD ?? 'Quarta scelta',
          ].filter(Boolean)
      ).slice(0, isSolo ? 2 : 4)
    : [];

  const voteChoices: Array<{ letter: VoteChoice | PreferirestiChoice; label: string; faction: 'a' | 'b' | 'accent' }> =
    isPreferiresti && preferirestiOptions.length > 0
      ? preferirestiOptions.map((label, idx) => ({
          letter: PREFERIRESTI_CHOICES[idx],
          label,
          faction: idx === 0 ? 'a' : idx === 1 ? 'b' : idx === 2 ? 'accent' : 'a',
        }))
      : [
          { letter: 'A', label: resolvedOptionA, faction: 'a' },
          { letter: 'B', label: resolvedOptionB, faction: 'b' },
        ];

  const selectedLabel = vote ? (voteChoices.find((c) => c.letter === vote)?.label ?? vote) : null;

  const subtitle =
    phase === 'VOTE_2'
      ? 'Hai sentito le difese: confermi o cambi idea?'
      : phase === 'DUO_PICK'
        ? 'Scegli la tua posizione.'
        : phase === 'DUO_REPICK'
          ? 'Ti ha convinto? Conferma o cambia.'
          : null;

  const dilemmaAudioUrl = dilemma ? getStoryAudioUrl(phase, null, dilemma) : null;
  const dilemmaAudioText = isPreferiresti
    ? `${partyCard?.prompt ?? dilemma?.text ?? ''} — ${preferirestiOptions.join('; ')}.`
    : dilemma
      ? `${dilemma.text} — ${resolvedOptionA}, oppure ${resolvedOptionB}.`
      : null;

  const dock = (
    <>
      {voteError ? (
        <Alert>{voteError}</Alert>
      ) : vote ? (
        <p style={{ opacity: 0.8, margin: 0, fontSize: '0.88rem' }}>
          Hai votato <strong>{selectedLabel}</strong>. Puoi cambiare prima della chiusura.
        </p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0, fontSize: '0.88rem' }}>
          {partyCard?.mode === 'coppie'
            ? 'Scegli con chi/cosa allinearti.'
            : 'Tocca la tua scelta per votare.'}
        </p>
      )}

      {isCastPhase &&
        (missingVoters && missingVoters.length > 0 ? (
          <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
            Aspettiamo {formatWaitingList(missingVoters)}…
          </p>
        ) : isSolo ? (
          <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
            1 tocco · Avanza subito
          </p>
        ) : (
          <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
            Hanno votato {votedCount}/{playerCount}
          </p>
        ))}

      {isConfirmPhase &&
        (confirmed ? (
          <>
            <p style={{ fontWeight: 800, margin: '0.15rem 0 0', fontSize: '1rem' }}>
              ✓ Hai confermato
            </p>
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>
              {missingVoters && missingVoters.length > 0
                ? `Aspettiamo ${formatWaitingList(missingVoters)}…`
                : `Aspettiamo gli altri… ${confirmedCount}/${playerCount}`}
            </p>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                vibrateWarning();
                onConfirm();
              }}
              style={{ marginTop: '0.15rem', width: '100%' }}
            >
              Confermo ✓
            </Button>
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>
              Conferma per proseguire — si va avanti quando confermano tutti ({confirmedCount}/
              {playerCount})
            </p>
          </>
        ))}

      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={PHASE_LABELS[phase]} dock={dock}>
      {isSolo && lastSoloFeedback && (
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.35rem 0.7rem',
            borderRadius: '999px',
            background: 'rgba(251, 191, 36, 0.14)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            color: '#fde68a',
            textAlign: 'center',
            maxWidth: 'min(90vw, 22rem)',
          }}
        >
          🧭 Scelta precedente: «{lastSoloFeedback.chosenLabel}» · {lastSoloFeedback.crowdPct}% come te
        </div>
      )}

      {subtitle && (
        <p style={{ opacity: 0.85, margin: 0, textAlign: 'center', maxWidth: '20rem' }}>
          {subtitle}
        </p>
      )}

      {/* Schierati Flash / Preferiresti Indicator */}
      {isFlash && (
        <div style={{ width: 'min(90vw, 22rem)', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.85rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              background: isSolo ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.25)',
              border: isSolo ? '2px solid #fbbf24' : '2px solid #ef4444',
              color: isSolo ? '#fde68a' : '#f87171',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              animation: 'pulse 1s infinite alternate',
            }}
          >
            {isSolo ? '⚡ SCELTA LAMPO · 2 OPZIONI' : '⚡ VOTA ADESSO! LA MINORANZA BEVE! 🍺'}
          </div>
        </div>
      )}

      {isPreferiresti && (
        <div style={{ width: 'min(90vw, 22rem)', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.85rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.2)',
              border: '2px solid #38bdf8',
              color: '#7dd3fc',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            🔀 PREFERIRESTI CHE... · SCEGLI SUBITO!
          </div>
        </div>
      )}

      {partyCard?.mode === 'coppie' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <div
            style={{
              fontSize: '0.8rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background:
                partyCard.intensity === 'piccante'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(236, 72, 153, 0.2)',
              border:
                partyCard.intensity === 'piccante'
                  ? '1px solid #ef4444'
                  : '1px solid #ec4899',
              color: partyCard.intensity === 'piccante' ? '#ef4444' : '#f472b6',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textAlign: 'center',
            }}
          >
            {partyCard.intensity === 'piccante' ? '🔞 Piccante 18+' : '💞 Complicità & Gelosia'} ·{' '}
            {partyCard.cardType === 'allineamento'
              ? 'Allineamento di Coppia'
              : partyCard.cardType === 'verita'
                ? 'Verità Scomoda'
                : 'Obbligo di Coppia'}
          </div>
          {partnerName && (
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fbcfe8' }}>
              💕 In coppia con {partnerName}
            </div>
          )}
        </div>
      )}

      {/* Secret question box for Infiltrato mode */}
      {secretQuestion && (
        <div
          style={{
            width: 'min(90vw, 22rem)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: secretQuestion.isInfiltrator
              ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.25) 0%, rgba(30, 20, 20, 0.85) 100%)'
              : 'linear-gradient(145deg, rgba(16, 185, 129, 0.25) 0%, rgba(15, 30, 25, 0.85) 100%)',
            border: secretQuestion.isInfiltrator ? '2px solid #ef4444' : '2px solid #10b981',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            boxShadow: secretQuestion.isInfiltrator
              ? '0 0 20px rgba(239, 68, 68, 0.5)'
              : '0 0 20px rgba(16, 185, 129, 0.4)',
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
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0, color: '#fff', lineHeight: 1.2 }}>
            {secretQuestion.question}
          </p>
          <span style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.2rem' }}>
            {secretQuestion.isInfiltrator
              ? 'Rispondi al volo a voce con 1 parola o frase credibile senza farti scoprire!'
              : 'Rispondi a voce alta con 1 parola quando tocca a te. Trova chi mente!'}
          </span>
        </div>
      )}

      {/* Assurdo La Gogna friend voting */}
      {partyCard?.mode === 'assurdo' && partyCard.cardType === 'gogna' && players && players.length > 0 && (
        <div style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#10b981', textAlign: 'center' }}>
            👑 VOTA L'AMICO PER LA GOGNA:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onGognaVote?.(p.id)}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: gognaVotedTarget === p.id ? '2px solid #10b981' : '1px solid var(--border)',
                  background:
                    gognaVotedTarget === p.id
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {p.nickname} {gognaVotedTarget === p.id && '✓'}
              </button>
            ))}
          </div>
        </div>
      )}

      {dilemma && (
        <>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', opacity: 0.96, margin: 0, textAlign: 'center', lineHeight: 1.25 }}>
            {dilemma.text}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CompactAudioPlayer
              audioUrl={dilemmaAudioUrl}
              fallbackText={dilemmaAudioText}
              label="Ascolta"
            />
          </div>
        </>
      )}

      {/* Main voting options centered in the main stage */}
      <div
        role="group"
        aria-label="Il tuo voto"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          width: 'min(92vw, 24rem)',
        }}
      >
        {voteChoices.map((opt) => (
          <VoteOption
            key={opt.letter}
            faction={opt.faction}
            label={opt.label}
            selected={vote === opt.letter}
            onClick={() => {
              vibrateTick();
              onVote(opt.letter);
            }}
            centered
          />
        ))}
      </div>
    </MobilePhaseShell>
  );
}
