 import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  SESSION_FORMATS,
  FORMAT_LABELS,
  FORMAT_DILEMMA_COUNT,
  CONTENT_REGISTERS,
  REGISTER_LABELS,
  MIN_PLAYERS_TO_START,
  START_ERROR_MESSAGES,
  PHASE_LABELS,
  type SessionFormat,
  type ContentRegister,
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
  const [format, setFormat] = useState<SessionFormat>('classica');
  const [register, setRegister] = useState<ContentRegister>('misto');
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
    getSocket().emit(SocketEvents.HostStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
    });
  };

  const advance = () => getSocket().emit(SocketEvents.HostAdvancePhase);

  const canStart = players.length >= MIN_PLAYERS_TO_START;
  const joinUrl = code ? `${window.location.origin}/?room=${code}` : '';

  // In-game: every phase past the lobby shows its label + a server-driven
  // countdown. Detailed per-phase content (dilemma text, vote tallies, …)
  // arrives in later stories; the host can always force-advance.
  if (phase !== 'LOBBY' && game) {
    const inDilemma = game.dilemmaIndex >= 1 && game.dilemmaCount != null;
    // Bind to local consts so the non-null narrowing survives inside the
    // option-mapping closures below (TS drops it for the mutable game fields).
    const dilemma = game.dilemma;
    const split = game.split;
    const defense = game.defense;
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

        {dilemma && (
          <section style={{ width: 'min(92vw, 50rem)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
              {dilemma.text}
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {(['A', 'B'] as const).map((letter) => (
                <div
                  key={letter}
                  style={{
                    flex: '1 1 14rem',
                    minWidth: '12rem',
                    padding: '1rem 1.25rem',
                    borderRadius: '0.9rem',
                    background: letter === 'A' ? 'rgba(79,140,255,0.18)' : 'rgba(255,140,79,0.18)',
                    border: `2px solid ${letter === 'A' ? 'rgba(79,140,255,0.5)' : 'rgba(255,140,79,0.5)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                    {letter === 'A' ? dilemma.optionA : dilemma.optionB}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'VOTE_1' && (
          <p
            aria-label="Quanti hanno votato"
            style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}
          >
            Hanno votato {game.votedCount}/{players.length}
          </p>
        )}

        {phase === 'VOTE_2' && (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
            Si vota di nuovo: confermate o cambiate idea dopo le difese 📱
          </p>
        )}

        {phase === 'SPLIT_REVEAL' && split && (
          <div
            aria-label="Come si è diviso il gruppo"
            style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {(['A', 'B'] as const).map((letter) => (
              <div
                key={letter}
                style={{
                  flex: '1 1 10rem',
                  minWidth: '8rem',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '0.9rem',
                  background: letter === 'A' ? 'rgba(79,140,255,0.18)' : 'rgba(255,140,79,0.18)',
                  border: `2px solid ${letter === 'A' ? 'rgba(79,140,255,0.5)' : 'rgba(255,140,79,0.5)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontSize: '1.6rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
                <span
                  style={{
                    fontSize: 'clamp(2.5rem, 9vw, 4.5rem)',
                    fontWeight: 800,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {letter === 'A' ? split.A : split.B}
                </span>
                <span style={{ fontSize: '1rem', opacity: 0.75 }}>
                  {(letter === 'A' ? split.A : split.B) === 1 ? 'voto' : 'voti'}
                </span>
              </div>
            ))}
          </div>
        )}

        {phase === 'DEFENSE' && defense && (
          defense.speaker ? (
            <section
              aria-label="Chi sta difendendo"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
            >
              {defense.totalTurns > 1 && (
                <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
                  Turno {defense.turn}/{defense.totalTurns}
                </p>
              )}
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                Sta parlando <span style={{ color: '#ffd36b' }}>{defense.speaker.nickname}</span> 🎤
              </p>
              <div
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.9rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  background:
                    defense.speaker.side === 'A' ? 'rgba(79,140,255,0.18)' : 'rgba(255,140,79,0.18)',
                  border: `2px solid ${
                    defense.speaker.side === 'A' ? 'rgba(79,140,255,0.5)' : 'rgba(255,140,79,0.5)'
                  }`,
                }}
              >
                Difende {defense.speaker.side} ·{' '}
                {defense.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
              </div>
            </section>
          ) : (
            <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>
              Nessuno ha votato: niente difese per questo dilemma.
            </p>
          )
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

          <section style={{ width: 'min(90vw, 36rem)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Componi la serata</h2>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Argomenti</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }} role="group" aria-label="Registro">
                {CONTENT_REGISTERS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegister(r)}
                    aria-pressed={register === r}
                    style={{
                      flex: '1 1 0',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      borderRadius: '0.6rem',
                      cursor: 'pointer',
                      border: register === r ? '2px solid #4f8cff' : '2px solid transparent',
                      background: register === r ? 'rgba(79,140,255,0.22)' : 'rgba(127,127,127,0.18)',
                    }}
                  >
                    {REGISTER_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }} role="group" aria-label="Formato">
                {SESSION_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                    style={{
                      flex: '1 1 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      borderRadius: '0.6rem',
                      cursor: 'pointer',
                      border: format === f ? '2px solid #4f8cff' : '2px solid transparent',
                      background: format === f ? 'rgba(79,140,255,0.22)' : 'rgba(127,127,127,0.18)',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>{FORMAT_LABELS[f].nome}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {FORMAT_LABELS[f].round} round · {FORMAT_LABELS[f].durata}
                    </span>
                  </button>
                ))}
              </div>
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
