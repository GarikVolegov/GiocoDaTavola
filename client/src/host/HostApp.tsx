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
  PERSONA_LABELS,
  OBJECTIVE,
  JOIN_ERROR_MESSAGES,
  VOTE_ERROR_MESSAGES,
  type SessionFormat,
  type ContentRegister,
  type RoomCreatedPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type HostStartErrorPayload,
  type PublicPlayer,
  type PlayerJoinedPayload,
  type PlayerJoinErrorPayload,
  type PlayerVotedPayload,
  type PlayerVoteErrorPayload,
  type VoteChoice,
} from '../shared/events';
import { Card, Pill, Button, Alert } from '../shared/ui';

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
  // "Gioca anche tu": the host can also join as a human player on this device.
  // We reuse the existing player:join/player:vote events on the host's socket
  // (one socket can be both host and player server-side), so the host counts as
  // the 1 human that enables solo play with bots — no phone / QR needed.
  const [myNickname, setMyNickname] = useState('Tu');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<VoteChoice | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

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
    // The host playing on this device joins/votes as a player too (same socket).
    const onJoined = ({ player }: PlayerJoinedPayload) => {
      setMyPlayerId(player.id);
      setJoinError(null);
    };
    const onJoinError = ({ error }: PlayerJoinErrorPayload) =>
      setJoinError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
    const onVoted = ({ choice }: PlayerVotedPayload) => {
      setMyVote(choice);
      setVoteError(null);
    };
    const onVoteError = ({ error }: PlayerVoteErrorPayload) =>
      setVoteError(VOTE_ERROR_MESSAGES[error] ?? 'Voto non riuscito');
    socket.on(SocketEvents.HostRoomCreated, onRoomCreated);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.HostStartError, onStartError);
    socket.on(SocketEvents.PlayerJoined, onJoined);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    socket.on(SocketEvents.PlayerVoted, onVoted);
    socket.on(SocketEvents.PlayerVoteError, onVoteError);
    socket.emit(SocketEvents.HostCreateRoom);
    return () => {
      socket.off(SocketEvents.HostRoomCreated, onRoomCreated);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.HostStartError, onStartError);
      socket.off(SocketEvents.PlayerJoined, onJoined);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off(SocketEvents.PlayerVoted, onVoted);
      socket.off(SocketEvents.PlayerVoteError, onVoteError);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote for the host.
  useEffect(() => {
    setMyVote(null);
    setVoteError(null);
  }, [game?.dilemmaIndex]);

  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.HostStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
    });
  };

  const advance = () => getSocket().emit(SocketEvents.HostAdvancePhase);
  const addBot = () => getSocket().emit(SocketEvents.HostAddBot);
  const removeBot = (id: string) => getSocket().emit(SocketEvents.HostRemoveBot, { id });

  // Join this room as a human player from the host device (reuses player:join).
  const joinAsPlayer = () => {
    const nick = myNickname.trim();
    if (!nick) {
      setJoinError(JOIN_ERROR_MESSAGES.NICKNAME_REQUIRED);
      return;
    }
    if (!code) return;
    setJoinError(null);
    getSocket().emit(SocketEvents.PlayerJoin, { code, nickname: nick });
  };
  // Cast (or change) the host-player's secret vote — optimistic, reconciled by
  // player:voted / player:voteError (same flow as the phone).
  const castVote = (choice: VoteChoice) => {
    setMyVote(choice);
    setVoteError(null);
    getSocket().emit(SocketEvents.PlayerVote, { choice });
  };

  // Solo play is allowed (1 human + bots), but never a bots-only game.
  const humanCount = players.filter((p) => !p.isBot).length;
  const canStart = players.length >= MIN_PLAYERS_TO_START && humanCount >= 1;
  const canAddBot = players.length < 8;
  const joinUrl = code ? `${window.location.origin}/join?room=${code}` : '';

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
    const swing = game.swing;
    const awards = game.awards;
    return (
      <main style={screen}>
        {inDilemma && (
          <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
            Dilemma {game.dilemmaIndex}/{game.dilemmaCount}
          </p>
        )}
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>

        {phase === 'PHASE_INTRO' && (
          <>
            <p style={{ fontSize: '1.5rem', opacity: 0.85, margin: 0, maxWidth: '40rem' }}>
              Vi mostreremo {game.dilemmaCount} dilemmi. Votate, ascoltate le difese e
              cambiate idea… se vi convincono!
            </p>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, maxWidth: '40rem' }}>
              🎯 {OBJECTIVE}
            </p>
          </>
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

        {(phase === 'VOTE_1' || phase === 'VOTE_2') && myPlayerId && (
          <div
            role="group"
            aria-label="Il tuo voto"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {(['A', 'B'] as const).map((letter) => {
                const selected = myVote === letter;
                const rgb = letter === 'A' ? '79,140,255' : '255,140,79';
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => castVote(letter)}
                    aria-pressed={selected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.7rem 1.4rem',
                      borderRadius: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: 'inherit',
                      background: selected ? `rgba(${rgb},0.32)` : `rgba(${rgb},0.12)`,
                      border: `2px solid rgba(${rgb},${selected ? 0.9 : 0.4})`,
                    }}
                  >
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
                    <span>{letter === 'A' ? dilemma?.optionA : dilemma?.optionB}</span>
                  </button>
                );
              })}
            </div>
            {voteError ? (
              <p role="alert" style={{ color: '#ff6b6b', margin: 0, fontWeight: 600 }}>
                {voteError}
              </p>
            ) : (
              <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
                Il tuo voto (visibile sullo schermo) — {myVote ? `hai scelto ${myVote}` : 'tocca A o B'}
              </p>
            )}
          </div>
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
                {defense.argument ? '🤖' : 'Sta parlando'}{' '}
                <span style={{ color: '#ffd36b' }}>{defense.speaker.nickname}</span> {defense.argument ? '' : '🎤'}
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
              {defense.argument && (
                <p style={{ fontSize: '1.4rem', fontStyle: 'italic', margin: 0, maxWidth: 'min(90vw, 44rem)', opacity: 0.95 }}>
                  “{defense.argument}”
                </p>
              )}
            </section>
          ) : (
            <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>
              Nessuno ha votato: niente difese per questo dilemma.
            </p>
          )
        )}

        {phase === 'PHASE_RESULTS' && swing && (
          <section
            aria-label="Risultati della persuasione"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', maxWidth: 'min(92vw, 50rem)' }}
          >
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              {swing.switched === 0
                ? 'Nessuno ha cambiato idea 🪨'
                : `${swing.switched} ${swing.switched === 1 ? 'persona ha' : 'persone hanno'} cambiato idea! 🔄`}
            </p>
            {swing.attribution.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {swing.attribution.map((imp) => (
                  <p key={imp.defender.id} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                    Le difese di <span style={{ color: '#ffd36b' }}>{imp.defender.nickname}</span> hanno
                    spostato {imp.votes} {imp.votes === 1 ? 'voto' : 'voti'} verso {imp.defender.side} ·{' '}
                    {imp.defender.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {phase === 'FINAL_AWARDS' &&
          (awards && awards.length > 0 ? (
            <section
              aria-label="Premi finali"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', maxWidth: 'min(92vw, 60rem)' }}
            >
              {awards.map((a) => (
                <Card
                  key={a.id}
                  glow="accent"
                  style={{ flex: '1 1 16rem', minWidth: '14rem', maxWidth: '18rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '2.5rem' }}>{a.emoji}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>{a.title}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffd36b' }}>{a.winner.nickname}</span>
                  <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>{a.description}</span>
                </Card>
              ))}
            </section>
          ) : (
            <p style={{ fontSize: '1.4rem', opacity: 0.8, margin: 0 }}>Grazie per aver giocato! 🎉</p>
          ))}

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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.9rem',
                      borderRadius: '999px',
                      background: p.isBot ? 'rgba(192,79,255,0.18)' : 'rgba(127,127,127,0.18)',
                      fontWeight: 600,
                    }}
                  >
                    {p.isBot && <span aria-label="bot">🤖</span>}
                    {p.nickname}
                    {p.isBot && p.persona && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                    )}
                    {p.isBot && (
                      <button
                        type="button"
                        onClick={() => removeBot(p.id)}
                        aria-label={`Rimuovi ${p.nickname}`}
                        style={{
                          marginLeft: '0.1rem',
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                          fontWeight: 800,
                          opacity: 0.7,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: '0.75rem' }}>
              <Button variant="ghost" onClick={addBot} disabled={!canAddBot}>
                + Aggiungi bot 🤖
              </Button>
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              {myPlayerId ? (
                <p style={{ margin: 0, fontWeight: 600 }}>🙋 Stai giocando anche tu su questo schermo</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <input
                      value={myNickname}
                      onChange={(e) => setMyNickname(e.target.value)}
                      placeholder="Il tuo nome"
                      maxLength={20}
                      aria-label="Il tuo nickname"
                      style={{ fontSize: '1rem', padding: '0.5rem 0.7rem', borderRadius: '0.6rem' }}
                    />
                    <Button variant="ghost" onClick={joinAsPlayer}>
                      Gioca anche tu 🙋
                    </Button>
                  </div>
                  <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>
                    Gioca da questo dispositivo, senza telefono (il tuo voto sarà visibile sullo schermo).
                  </p>
                </>
              )}
              {joinError && <Alert>{joinError}</Alert>}
            </div>
          </section>

          <Card
            glow="accent"
            style={{ width: 'min(90vw, 36rem)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}
          >
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Componi la serata</h2>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Argomenti</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Registro">
                {CONTENT_REGISTERS.map((r) => (
                  <Pill
                    key={r}
                    selected={register === r}
                    onClick={() => setRegister(r)}
                    aria-label={REGISTER_LABELS[r]}
                  >
                    {REGISTER_LABELS[r]}
                  </Pill>
                ))}
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Formato">
                {SESSION_FORMATS.map((f) => (
                  <Pill
                    key={f}
                    selected={format === f}
                    onClick={() => setFormat(f)}
                    aria-label={`${FORMAT_LABELS[f].nome}, ${FORMAT_LABELS[f].round} round, ${FORMAT_LABELS[f].durata}`}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                      <span style={{ fontWeight: 700 }}>{FORMAT_LABELS[f].nome}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {FORMAT_LABELS[f].round} round · {FORMAT_LABELS[f].durata}
                      </span>
                    </span>
                  </Pill>
                ))}
              </div>
            </div>

            <Button variant="primary" size="lg" onClick={startGame} disabled={!canStart}>
              Inizia la partita
            </Button>
            {!canStart && (
              <p style={{ opacity: 0.6, margin: 0 }}>
                {humanCount < 1
                  ? 'Serve almeno una persona (i bot da soli non bastano).'
                  : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi giocatori o bot 🤖`}
              </p>
            )}
            {startError && <Alert>{startError}</Alert>}
          </Card>
        </>
      ) : (
        <p style={{ opacity: 0.7 }}>Creazione stanza…</p>
      )}
    </main>
  );
}
