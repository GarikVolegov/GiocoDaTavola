import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  DILEMMA_COUNT_OPTIONS,
  MIN_PLAYERS_TO_START,
  START_ERROR_MESSAGES,
  PHASE_LABELS,
  type RoomCreatedPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type HostStartErrorPayload,
  type PublicPlayer,
} from '../shared/events';

const screen = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  textAlign: 'center',
  padding: '2rem',
  gap: '1.5rem',
} as const;

// Shared screen (TV / tablet / laptop). On open it asks the server for a room
// and shows the join code large + a QR pointing phones at the join URL.
export default function HostApp() {
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [chosenCount, setChosenCount] = useState<number>(DILEMMA_COUNT_OPTIONS[0]);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onRoomCreated = ({ code }: RoomCreatedPayload) => setCode(code);
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => {
      setGame(payload);
      setStartError(null);
    };
    const onStartError = ({ error }: HostStartErrorPayload) =>
      setStartError(START_ERROR_MESSAGES[error] ?? 'Impossibile avviare la partita');
    socket.on(SocketEvents.HostRoomCreated, onRoomCreated);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.HostStartError, onStartError);
    socket.emit(SocketEvents.HostCreateRoom);
    return () => {
      socket.off(SocketEvents.HostRoomCreated, onRoomCreated);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.HostStartError, onStartError);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.HostStartGame, { dilemmaCount: chosenCount });
  };

  const advance = () => getSocket().emit(SocketEvents.HostAdvancePhase);

  const canStart = players.length >= MIN_PLAYERS_TO_START;
  const joinUrl = code ? `${window.location.origin}/?room=${code}` : '';

  // In-game: every phase past the lobby shows its label + a server-driven
  // countdown. Detailed per-phase content (dilemma text, vote tallies, …)
  // arrives in later stories; the host can always force-advance.
  if (phase !== 'LOBBY' && game) {
    const inDilemma = game.dilemmaIndex >= 1 && game.dilemmaCount != null;
    return (
      <main style={screen}>
        {inDilemma && (
          <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
            Dilemma {game.dilemmaIndex}/{game.dilemmaCount}
          </p>
        )}
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>

        {phase === 'PHASE_INTRO' && (
          <p style={{ fontSize: '1.5rem', opacity: 0.85, margin: 0, maxWidth: '40rem' }}>
            Vi mostreremo {game.dilemmaCount} dilemmi. Votate, ascoltate le difese e
            cambiate idea… se vi convincono!
          </p>
        )}

        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {remaining}s
          </div>
        )}

        {phase !== 'FINAL_AWARDS' && (
          <button
            type="button"
            onClick={advance}
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              padding: '0.6rem 1.8rem',
              borderRadius: '0.7rem',
              cursor: 'pointer',
            }}
          >
            Avanti ⏭
          </button>
        )}
      </main>
    );
  }

  return (
    <main style={screen}>
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Dibattiti tra amici</h1>

      {code ? (
        <>
          <p style={{ opacity: 0.7, margin: 0 }}>
            Entra da <strong>{window.location.host}</strong> con il codice
          </p>
          <div
            style={{
              fontSize: 'clamp(4rem, 18vw, 9rem)',
              fontWeight: 800,
              letterSpacing: '0.4rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 1,
            }}
          >
            {code}
          </div>
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '1rem' }}>
            <QRCodeSVG value={joinUrl} size={220} />
          </div>
          <p style={{ opacity: 0.7, margin: 0 }}>Inquadra il QR per entrare dal telefono</p>

          <section style={{ marginTop: '0.5rem', width: 'min(90vw, 36rem)' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>
              Giocatori ({players.length}/8)
            </h2>
            {players.length === 0 ? (
              <p style={{ opacity: 0.6, margin: 0 }}>In attesa di giocatori…</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'center',
                }}
              >
                {players.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '999px',
                      background: 'rgba(127,127,127,0.18)',
                      fontWeight: 600,
                    }}
                  >
                    {p.nickname}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ width: 'min(90vw, 36rem)', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <p style={{ opacity: 0.8, margin: 0 }}>Quanti dilemmi?</p>
            <div style={{ display: 'flex', gap: '0.6rem' }} role="group" aria-label="Numero di dilemmi">
              {DILEMMA_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setChosenCount(n)}
                  aria-pressed={chosenCount === n}
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    width: '3.2rem',
                    padding: '0.5rem 0',
                    borderRadius: '0.6rem',
                    cursor: 'pointer',
                    border: chosenCount === n ? '2px solid #4f8cff' : '2px solid transparent',
                    background: chosenCount === n ? 'rgba(79,140,255,0.22)' : 'rgba(127,127,127,0.18)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={startGame}
              disabled={!canStart}
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                padding: '0.7rem 2.5rem',
                borderRadius: '0.7rem',
                cursor: canStart ? 'pointer' : 'not-allowed',
                opacity: canStart ? 1 : 0.5,
              }}
            >
              Inizia la partita
            </button>
            {!canStart && (
              <p style={{ opacity: 0.6, margin: 0 }}>
                Servono almeno {MIN_PLAYERS_TO_START} giocatori per iniziare.
              </p>
            )}
            {startError && (
              <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
                {startError}
              </p>
            )}
          </section>
        </>
      ) : (
        <p style={{ opacity: 0.7 }}>Creazione stanza…</p>
      )}
    </main>
  );
}
