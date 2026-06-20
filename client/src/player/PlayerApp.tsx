import { useEffect, useState, type FormEvent } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  VOTE_ERROR_MESSAGES,
  PHASE_LABELS,
  OBJECTIVE,
  HOW_TO_PLAY,
  type PlayerJoinedPayload,
  type PlayerJoinErrorPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type PublicPlayer,
  type VoteChoice,
  type PlayerVotedPayload,
  type PlayerVoteErrorPayload,
} from '../shared/events';
import { Card } from '../shared/ui';

// Read a prefilled room code from the QR join URL (`/?room=CODE`).
function initialCode(): string {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
}

// Per-player phone view. Shows a join form (code + nickname); once joined,
// shows the realtime lobby roster.
export default function PlayerApp() {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onJoined = ({ code, player }: PlayerJoinedPayload) => {
      setJoinedCode(code);
      setPlayerId(player.id);
      setError(null);
      setSubmitting(false);
    };
    const onJoinError = ({ error }: PlayerJoinErrorPayload) => {
      setError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
      setSubmitting(false);
    };
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => setGame(payload);
    // The server confirms our own current choice (so a refused change reverts).
    const onVoted = ({ choice }: PlayerVotedPayload) => {
      setVote(choice);
      setVoteError(null);
    };
    const onVoteError = ({ error }: PlayerVoteErrorPayload) =>
      setVoteError(VOTE_ERROR_MESSAGES[error] ?? 'Voto non riuscito');
    socket.on(SocketEvents.PlayerJoined, onJoined);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.PlayerVoted, onVoted);
    socket.on(SocketEvents.PlayerVoteError, onVoteError);
    return () => {
      socket.off(SocketEvents.PlayerJoined, onJoined);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.PlayerVoted, onVoted);
      socket.off(SocketEvents.PlayerVoteError, onVoteError);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote.
  useEffect(() => {
    setVote(null);
    setVoteError(null);
  }, [game?.dilemmaIndex]);

  const castVote = (choice: VoteChoice) => {
    setVote(choice); // optimistic; reverts via player:voted/voteError
    setVoteError(null);
    getSocket().emit(SocketEvents.PlayerVote, { choice });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedNick = nickname.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedNick) {
      setError(JOIN_ERROR_MESSAGES.NICKNAME_REQUIRED);
      return;
    }
    setError(null);
    setSubmitting(true);
    getSocket().emit(SocketEvents.PlayerJoin, { code: trimmedCode, nickname: trimmedNick });
  };

  const wrap = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    textAlign: 'center',
    padding: '1.5rem',
    gap: '1rem',
  } as const;

  if (joinedCode && (phase === 'VOTE_1' || phase === 'VOTE_2')) {
    const dilemma = game?.dilemma;
    // VOTE_2 is the re-vote after the defenses: the phone keeps the player's
    // first choice selected as the default, which they can keep or change.
    const isSecondVote = phase === 'VOTE_2';
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>
        {isSecondVote && (
          <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0 }}>
            Hai sentito le difese: confermi o cambi idea?
          </p>
        )}
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        {dilemma && (
          <p style={{ fontSize: '1.1rem', opacity: 0.85, margin: 0 }}>{dilemma.text}</p>
        )}
        <div
          role="group"
          aria-label="Il tuo voto"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
        >
          {(['A', 'B'] as const).map((letter) => {
            const selected = vote === letter;
            const accent = letter === 'A' ? '79,140,255' : '255,140,79';
            return (
              <button
                key={letter}
                type="button"
                onClick={() => castVote(letter)}
                aria-pressed={selected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  padding: '1rem 1.1rem',
                  borderRadius: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: 'inherit',
                  background: selected ? `rgba(${accent},0.32)` : `rgba(${accent},0.12)`,
                  border: `2px solid rgba(${accent},${selected ? 0.9 : 0.4})`,
                }}
              >
                <span style={{ fontSize: '1.6rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
                <span style={{ fontSize: '1.1rem' }}>
                  {dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
                </span>
              </button>
            );
          })}
        </div>
        {voteError ? (
          <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
            {voteError}
          </p>
        ) : vote ? (
          <p style={{ opacity: 0.8, margin: 0 }}>
            Hai votato <strong>{vote}</strong>. Puoi cambiare finché c’è tempo.
          </p>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Tocca A o B per votare.</p>
        )}
      </main>
    );
  }

  if (joinedCode && phase === 'DEFENSE') {
    const speaker = game?.defense?.speaker ?? null;
    const myTurn = speaker != null && speaker.id === playerId;
    const sideOption = speaker
      ? speaker.side === 'A'
        ? game?.dilemma?.optionA
        : game?.dilemma?.optionB
      : undefined;
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DEFENSE}</h1>
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        {speaker == null ? (
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
            Nessuna difesa per questo dilemma.
          </p>
        ) : myTurn ? (
          <>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
              Difendi <strong>{speaker.side}</strong>
              {sideOption ? `: ${sideOption}` : ''}
            </p>
          </>
        ) : (
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            Sta parlando <strong>{speaker.nickname}</strong> 🎤
          </p>
        )}
      </main>
    );
  }

  if (joinedCode && phase !== 'LOBBY') {
    const switched = game?.swing?.switched ?? 0;
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
        {phase === 'PHASE_INTRO' ? (
          <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, maxWidth: '22rem' }}>
            🎯 {OBJECTIVE}
          </p>
        ) : phase === 'PHASE_RESULTS' ? (
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
            {switched === 0
              ? 'Nessuno ha cambiato idea dopo le difese.'
              : `${switched} ${switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea dopo le difese!`}
          </p>
        ) : phase === 'FINAL_AWARDS' ? (
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            🏆 Guarda i premi sullo schermo!
          </p>
        ) : (
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
            Guarda lo schermo condiviso 👀
          </p>
        )}
      </main>
    );
  }

  if (joinedCode) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Sei nella stanza</h1>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '0.3rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {joinedCode}
        </div>
        <h2 style={{ fontSize: '1.1rem', margin: '0.5rem 0 0' }}>
          Giocatori ({players.length}/8)
        </h2>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            width: 'min(90vw, 22rem)',
          }}
        >
          {players.map((p) => (
            <li
              key={p.id}
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '0.6rem',
                background: 'rgba(127,127,127,0.18)',
                fontWeight: 600,
              }}
            >
              {p.nickname}
            </li>
          ))}
        </ul>

        <Card
          glow="accent"
          style={{
            width: 'min(90vw, 22rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            textAlign: 'left',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Come funziona</h3>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {HOW_TO_PLAY.map((step) => (
              <li key={step} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{step}</li>
            ))}
          </ol>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 700 }}>
            🎯 {OBJECTIVE}
          </p>
        </Card>

        <p style={{ opacity: 0.7, margin: 0 }}>In attesa che l’host avvii la partita…</p>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Entra nella partita</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>Inserisci il codice e il tuo nome.</p>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          width: 'min(90vw, 22rem)',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
          <span style={{ opacity: 0.8 }}>Codice stanza</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            style={{
              fontSize: '1.5rem',
              letterSpacing: '0.3rem',
              textAlign: 'center',
              padding: '0.6rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
          <span style={{ opacity: 0.8 }}>Nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Il tuo nome"
            maxLength={20}
            style={{ fontSize: '1.25rem', padding: '0.6rem' }}
          />
        </label>
        {error && (
          <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            padding: '0.7rem',
            borderRadius: '0.6rem',
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Entro…' : 'Entra'}
        </button>
      </form>
    </main>
  );
}
