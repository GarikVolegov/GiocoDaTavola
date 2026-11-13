import { useEffect, useRef, type ReactNode } from 'react';
import {
  PHASE_LABELS,
  type VoteChoice,
  type PartyCardPayload,
  type PlayerSecretQuestionPayload,
} from '../../shared/events';
import { Button, VoteOption, Alert } from '../../shared/ui';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';
import { useIsSpeaking, unlockSpeech } from '../../host/audio/narrator';
import { unlockAudio } from '../../host/audio/engine';
import { getStoryAudioUrl, playStoryAudio, stopStoryAudio } from '../../host/audio/storyAudioPlayer';
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
  remaining: number | null;
  vote: VoteChoice | null;
  voteError: string | null;
  onVote: (choice: VoteChoice) => void;
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
  myHotSeatBet?: 'match' | 'scoppiano' | null;
  onHotSeatBet?: (bet: 'match' | 'scoppiano') => void;
}

export default function VoteView({
  phase,
  dilemma,
  remaining,
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
  myHotSeatBet,
  onHotSeatBet,
}: VoteViewProps) {
  const isCastPhase = phase === 'VOTE_1' || phase === 'DUO_SIDE_PICK' || phase === 'DUO_PICK';
  const isConfirmPhase = phase === 'VOTE_2' || phase === 'DUO_REPICK';

  const isFlash = partyCard?.mode === 'flash';
  // In Flash mode, first 3s (remaining > 3) are reading-protected; last 3s (remaining <= 3) are vote countdown
  const isFlashReading = isFlash && remaining != null && remaining > 3;

  // Haptic feedback tick in the final countdown seconds
  const lastRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    if (remaining != null && remaining !== lastRemainingRef.current) {
      lastRemainingRef.current = remaining;
      if (isFlash && remaining <= 3 && remaining > 0) {
        vibrateTick();
      } else if (remaining <= 2 && remaining > 0) {
        vibrateWarning();
      }
    }
  }, [remaining, isFlash]);

  const isHotSeatActor = Boolean(
    partyCard?.mode === 'coppie' &&
      partyCard.hotSeat &&
      myPlayerId &&
      partyCard.hotSeat.coupleIds?.includes(myPlayerId),
  );
  const isHotSeatSpectator = Boolean(
    partyCard?.mode === 'coppie' && partyCard.hotSeat && !isHotSeatActor,
  );

  const isSpeaking = useIsSpeaking();
  const subtitle =
    phase === 'VOTE_2'
      ? 'Hai sentito le difese: confermi o cambi idea?'
      : phase === 'DUO_PICK'
        ? 'Scegli la tua posizione.'
        : phase === 'DUO_REPICK'
          ? 'Ti ha convinto? Conferma o cambia.'
          : null;

  const replayDilemma = () => {
    if (isSpeaking) {
      stopStoryAudio();
    } else if (dilemma) {
      unlockAudio();
      unlockSpeech();
      const audioUrl = getStoryAudioUrl(phase, null, dilemma);
      const text = `Al bivio… ${dilemma.text} — Opzione A: ${dilemma.optionA}. — Opzione B: ${dilemma.optionB}.`;
      playStoryAudio(audioUrl, text);
    }
  };

  const dock = (
    <>
      {/* Main A/B voting options pinned in the mobile thumb-zone */}
      {!isHotSeatSpectator && (
        <div
          role="group"
          aria-label="Il tuo voto"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            width: '100%',
            opacity: isFlashReading ? 0.45 : 1,
            pointerEvents: isFlashReading ? 'none' : 'auto',
            transition: 'opacity 200ms ease',
          }}
        >
          {(['A', 'B'] as const).map((letter) => (
            <VoteOption
              key={letter}
              faction={letter === 'A' ? 'a' : 'b'}
              letter={letter}
              label={dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
              selected={vote === letter}
              onClick={() => {
                vibrateTick();
                onVote(letter);
              }}
              centered
            />
          ))}
        </div>
      )}

      {voteError ? (
        <Alert>{voteError}</Alert>
      ) : vote ? (
        <p style={{ opacity: 0.8, margin: 0, fontSize: '0.88rem' }}>
          Hai votato <strong>{vote}</strong>. Puoi cambiare finché c’è tempo.
        </p>
      ) : !isHotSeatSpectator ? (
        <p style={{ opacity: 0.7, margin: 0, fontSize: '0.88rem' }}>
          {isFlashReading ? 'Aspetta lo sblocco per votare…' : 'Tocca A o B per votare.'}
        </p>
      ) : null}

      {isCastPhase &&
        (missingVoters && missingVoters.length > 0 ? (
          <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
            Aspettiamo {formatWaitingList(missingVoters)}…
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
    <MobilePhaseShell title={PHASE_LABELS[phase]} remaining={remaining} dock={dock}>
      {subtitle && (
        <p style={{ opacity: 0.85, margin: 0, textAlign: 'center', maxWidth: '20rem' }}>
          {subtitle}
        </p>
      )}

      {/* Schierati Flash 3+3s Indicators */}
      {isFlash && (
        <div style={{ width: 'min(90vw, 22rem)', textAlign: 'center' }}>
          {isFlashReading ? (
            <div
              style={{
                fontSize: '0.85rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.25)',
                border: '1.5px solid #3b82f6',
                color: '#60a5fa',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              📖 LETTURA PROTETTA · SBLOCCO TRA {remaining - 3}s
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.85rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '2px solid #ef4444',
                color: '#f87171',
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                animation: 'pulse 1s infinite alternate',
              }}
            >
              ⚡ VOTA ADESSO! LA MINORANZA BEVE! 🍺
            </div>
          )}
        </div>
      )}

      {partyCard?.mode === 'coppie' && (
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
            ? 'Allineamento Cieco'
            : partyCard.cardType === 'verita'
              ? 'Verità Scomoda'
              : 'Obbligo Rapido'}
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

      {/* Coppie Hot-Seat Spectator Betting UI */}
      {isHotSeatSpectator && partyCard?.hotSeat && (
        <div
          style={{
            width: 'min(90vw, 22rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'rgba(236, 72, 153, 0.1)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid rgba(236, 72, 153, 0.35)',
            textAlign: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🔥 COPPIA AL CENTRO (HOT-SEAT)
            </span>
            <p style={{ margin: '0.2rem 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
              {partyCard.hotSeat.coupleNicknames?.[0] ?? ''} & {partyCard.hotSeat.coupleNicknames?.[1] ?? ''}
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
              Scommetti: secondo te la pensano uguale o litigano?
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onHotSeatBet?.('match')}
              style={{
                padding: '0.75rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: myHotSeatBet === 'match' ? '2px solid #ec4899' : '1px solid rgba(236, 72, 153, 0.3)',
                background: myHotSeatBet === 'match' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                alignItems: 'center',
              }}
            >
              <span>💞 Matchano</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>Stessa scelta (+50 pt)</span>
            </button>

            <button
              type="button"
              onClick={() => onHotSeatBet?.('scoppiano')}
              style={{
                padding: '0.75rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: myHotSeatBet === 'scoppiano' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                background: myHotSeatBet === 'scoppiano' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                alignItems: 'center',
              }}
            >
              <span>💥 Scoppiano</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>Scelte opposte (+50 pt)</span>
            </button>
          </div>

          {myHotSeatBet && (
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#f472b6' }}>
              ✓ Hai scommesso: {myHotSeatBet === 'match' ? 'Matchano 💞' : 'Scoppiano 💥'}
            </p>
          )}
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
            <button
              type="button"
              onClick={replayDilemma}
              style={{
                background: isSpeaking ? 'rgba(229, 193, 88, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${isSpeaking ? 'var(--gold)' : 'rgba(255, 255, 255, 0.2)'}`,
                borderRadius: '999px',
                padding: '0.35rem 0.85rem',
                minHeight: '2.5rem',
                color: isSpeaking ? 'var(--gold)' : 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              aria-label={isSpeaking ? 'Ferma voce' : 'Riascolta opzioni ad alta voce'}
            >
              {isSpeaking ? '⏹️ Ferma voce' : '🔊 Riascolta opzioni'}
            </button>
          </div>
        </>
      )}
    </MobilePhaseShell>
  );
}
