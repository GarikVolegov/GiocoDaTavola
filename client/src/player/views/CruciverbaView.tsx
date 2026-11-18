import { useEffect, useState, type ReactNode } from 'react';
import { PHASE_LABELS, type CruciverbaStatePayload } from '../../shared/events';
import { Button, Card, CruciverbaGrid, Pill, TextInput } from '../../shared/ui';
import MobilePhaseShell from './MobilePhaseShell';

interface CruciverbaViewProps {
  phase: 'CRUCIVERBA' | 'CRUCIVERBA_REVEAL';
  state: CruciverbaStatePayload | null | undefined;
  myId: string | null;
  isLeader?: boolean;
  turnRemaining?: number | null;
  phaseRemaining?: number | null;
  readingRemaining?: number | null;
  feedback?: string | null;
  onAttempt: (guess: string, wordId: string) => void;
  onPassHint: () => void;
  onFinishReading?: () => void;
  skipButton: ReactNode;
}

export default function CruciverbaView({
  phase,
  state,
  myId,
  isLeader: _isLeader = false,
  turnRemaining: _turnRemaining = null,
  phaseRemaining: _phaseRemaining = null,
  readingRemaining: _readingRemaining = null,
  feedback,
  onAttempt,
  onPassHint,
  onFinishReading: _onFinishReading,
  skipButton,
}: CruciverbaViewProps) {
  const [selectedWordId, setSelectedWordId] = useState<string>('');
  const [guess, setGuess] = useState('');

  useEffect(() => {
    if (!state) return;
    const stillPending = state.words.find((w) => w.id === selectedWordId && w.status === 'pending');
    if (!stillPending) {
      setSelectedWordId(state.activeWordId);
    }
  }, [state, selectedWordId]);

  useEffect(() => {
    setGuess('');
  }, [state?.activePlayerId, state?.turnsTaken]);

  if (!state) return null;

  if (phase === 'CRUCIVERBA_REVEAL') {
    const solvedCount = state.words.filter((w) => w.status === 'solved').length;
    return (
      <MobilePhaseShell
        title={`🧩 ${PHASE_LABELS.CRUCIVERBA_REVEAL}`}
        dock={skipButton}
      >
        <Card
          glow="accent"
          style={{
            width: '100%',
            padding: '0.95rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6ee7b7' }}>
            {solvedCount}/{state.words.length} PAROLE INDOVINATE · {state.theme.toUpperCase()}
          </div>
          <CruciverbaGrid state={state} size="sm" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
            {state.words.map((w) => (
              <div
                key={w.id}
                style={{
                  fontSize: '0.82rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  background: w.status === 'solved' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <span>
                  <strong>
                    {w.number} {w.direction === 'H' ? 'Oriz.' : 'Vert.'}:
                  </strong>{' '}
                  {w.answer}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {w.solvedByName ? `✓ ${w.solvedByName}` : 'Svelata'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </MobilePhaseShell>
    );
  }

  const isMyTurn = Boolean(myId && state.activePlayerId === myId);
  const targetWord =
    state.words.find((w) => w.id === selectedWordId && w.status === 'pending') ??
    state.words.find((w) => w.id === state.activeWordId && w.status === 'pending') ??
    state.words.find((w) => w.status === 'pending') ??
    state.words[0];

  return (
    <MobilePhaseShell
      title={`🧩 ${state.theme}`}
      dock={skipButton}
    >
      <Card
        glow={isMyTurn ? 'accent' : undefined}
        style={{
          width: '100%',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          borderColor: isMyTurn ? '#fbbf24' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            padding: '0.45rem 0.7rem',
            borderRadius: '10px',
            background: isMyTurn
              ? 'rgba(251, 191, 36, 0.18)'
              : 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: '0.9rem',
              color: isMyTurn ? '#fde68a' : '#f8fafc',
            }}
          >
            {isMyTurn
              ? '🎙️ TOCCA A TE!'
              : `⏳ TURNO DI ${state.activePlayerName?.toUpperCase() ?? '...'}`}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>
            Turno {Math.min(state.turnsTaken + 1, state.maxTurns)}/{state.maxTurns}
          </span>
        </div>

        <CruciverbaGrid
          state={state}
          selectedWordId={targetWord?.id}
          onSelectWord={(wId) => {
            const w = state.words.find((item) => item.id === wId);
            if (w && w.status === 'pending') setSelectedWordId(wId);
          }}
          size="sm"
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
          {state.words.map((w) => (
            <Pill
              key={w.id}
              selected={w.id === targetWord?.id}
              onClick={w.status === 'pending' ? () => setSelectedWordId(w.id) : undefined}
            >
              {w.number}
              {w.direction === 'H' ? '→' : '↓'} ({w.length})
              {w.status === 'solved' ? ' ✓' : w.status === 'revealed' ? ' ·' : ''}
            </Pill>
          ))}
        </div>

        {targetWord && (
          <div
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '0.88rem',
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', marginBottom: '0.2rem' }}>
              DEFINIZIONE {targetWord.number} {targetWord.direction === 'H' ? 'ORIZZONTALE' : 'VERTICALE'} · {targetWord.length} LETTERE
            </div>
            <div>{targetWord.clue}</div>
          </div>
        )}

        {feedback && (
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fda4af', textAlign: 'center' }}>
            {feedback}
          </div>
        )}

        {isMyTurn && targetWord && targetWord.status === 'pending' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!guess.trim()) return;
              onAttempt(guess, targetWord.id);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <TextInput
              value={guess}
              onChange={(e) => setGuess(e.target.value.toUpperCase())}
              placeholder={`Scrivi la parola (${targetWord.length} lettere)...`}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="submit" variant="primary" disabled={!guess.trim()} style={{ flex: 1 }}>
                Invia Parola ✓
              </Button>
              <Button type="button" variant="ghost" onClick={onPassHint}>
                💡 1 lettera
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Guarda il tabellone: quando tocca a te prova a risolvere o sblocca 1 lettera!
          </div>
        )}
      </Card>
    </MobilePhaseShell>
  );
}
