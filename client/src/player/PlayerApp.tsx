import { useEffect, useState, type FormEvent } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  PHASE_LABELS,
  type PlayerJoinedPayload,
  type PlayerJoinErrorPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type PublicPlayer,
} from '../shared/events';

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onJoined = ({ code }: PlayerJoinedPayload) => {
      setJoinedCode(code);
      setError(null);
      setSubmitting(false);
    };
    const onJoinError = ({ error }: PlayerJoinErrorPayload) => {
      setError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
      setSubmitting(false);
    };
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => setGame(payload);
    socket.on(SocketEvents.PlayerJoined, onJoined);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    return () => {
      socket.off(SocketEvents.PlayerJoined, onJoined);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

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

  if (joinedCode && phase !== 'LOBBY') {
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
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
          Guarda lo schermo condiviso 👀
        </p>
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
        <p style={{ opacity: 0.7, margin: 0 }}>In attesa che l’host avvii la partita…</p>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Dibattiti tra amici</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>Entra nella stanza dal tuo telefono.</p>
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
