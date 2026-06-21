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
  GAME_MODES,
  MODE_LABELS,
  type GameMode,
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
  type PlayerPredictedPayload,
  type VoteChoice,
} from '../shared/events';
import { Card, Pill, Button, Alert } from '../shared/ui';
import ReactionSwarm from './ReactionSwarm';

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
  const [mode, setMode] = useState<GameMode>('gruppo');
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
  const [myPrediction, setMyPrediction] = useState<VoteChoice | null>(null);

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
    const onPredicted = ({ choice }: PlayerPredictedPayload) => setMyPrediction(choice);
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
    socket.on(SocketEvents.PlayerPredicted, onPredicted);
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
      socket.off(SocketEvents.PlayerPredicted, onPredicted);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote + prediction.
  useEffect(() => {
    setMyVote(null);
    setVoteError(null);
    setMyPrediction(null);
  }, [game?.dilemmaIndex]);

  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.HostStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
      mode,
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
  const castPrediction = (choice: VoteChoice) => {
    setMyPrediction(choice);
    getSocket().emit(SocketEvents.PlayerPredict, { choice });
  };

  // Gruppo: solo play allowed (1 human + bots), never bots-only. Duello: exactly
  // two humans (no bot opponent).
  const humanCount = players.filter((p) => !p.isBot).length;
  const canStart =
    mode === 'duello'
      ? players.length === 2 && humanCount === 2
      : players.length >= MIN_PLAYERS_TO_START && humanCount >= 1;
  const canAddBot = mode !== 'duello' && players.length < 8;
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
    const duelReveal = game.duelReveal;
    const duelTurn = game.duelTurn;
    const duelResult = game.duelResult;
    const duelSummary = game.duelSummary;
    return (
      <main style={screen}>
        <ReactionSwarm />
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

        {phase === 'PREDICT' && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
              🔮 Pronosticate: chi avrà più voti <em>dopo</em> le difese? · {game.predictedCount}/{players.length}
            </p>
            {myPlayerId && (
              <div
                role="group"
                aria-label="Il tuo pronostico"
                style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
              >
                {(['A', 'B'] as const).map((letter) => {
                  const selected = myPrediction === letter;
                  const rgb = letter === 'A' ? '79,140,255' : '255,140,79';
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => castPrediction(letter)}
                      aria-pressed={selected}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '1.2rem',
                        color: 'inherit',
                        background: selected ? `rgba(${rgb},0.32)` : `rgba(${rgb},0.12)`,
                        border: `2px solid rgba(${rgb},${selected ? 0.9 : 0.4})`,
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {phase === 'SPEAKER_VOTE' && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
            🎤 Votate dal telefono il più convincente · {game.speakerVotedCount}/{players.length}
          </p>
        )}

        {(phase === 'VOTE_1' || phase === 'VOTE_2' || phase === 'DUEL_PICK' || phase === 'DUEL_REPICK') &&
          myPlayerId && (
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
              {game.isDevilRound && (
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#ffd36b' }}>
                  🎭 Avvocato del Diavolo — si difende il lato OPPOSTO al proprio voto!
                </p>
              )}
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
                {defense.speaker.devil ? '🎭 ' : ''}Difende {defense.speaker.side} ·{' '}
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

        {phase === 'DUEL_PICK' && (
          <p aria-label="Quanti hanno scelto" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Scegliete in segreto ({game.votedCount}/2)
          </p>
        )}

        {phase === 'DUEL_REVEAL' && duelReveal && (
          <section
            aria-label="Le vostre scelte"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {duelReveal.picks.map((p) => {
                const rgb = p.choice === 'A' ? '79,140,255' : '255,140,79';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '1rem 1.4rem',
                      borderRadius: '0.9rem',
                      background: `rgba(${rgb},0.18)`,
                      border: `2px solid rgba(${rgb},0.5)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{p.nickname}</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{p.choice}</span>
                    <span style={{ fontSize: '0.95rem', opacity: 0.85 }}>
                      {p.choice === 'A' ? dilemma?.optionA : dilemma?.optionB}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              {duelReveal.agreed ? '🤝 Siete d’accordo!' : '⚔️ Si va al duello!'}
            </p>
          </section>
        )}

        {phase === 'DUEL_ARGUE' && duelTurn?.speaker && (
          <section
            aria-label="Chi argomenta"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <p style={{ opacity: 0.7, margin: 0, fontSize: '1.1rem' }}>
              Turno {duelTurn.turn}/{duelTurn.totalTurns}
            </p>
            <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
              Argomenta <span style={{ color: '#ffd36b' }}>{duelTurn.speaker.nickname}</span> 🎤
            </p>
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.9rem',
                fontSize: '1.25rem',
                fontWeight: 700,
                background: duelTurn.speaker.side === 'A' ? 'rgba(79,140,255,0.18)' : 'rgba(255,140,79,0.18)',
                border: `2px solid ${duelTurn.speaker.side === 'A' ? 'rgba(79,140,255,0.5)' : 'rgba(255,140,79,0.5)'}`,
              }}
            >
              Difende {duelTurn.speaker.side} ·{' '}
              {duelTurn.speaker.side === 'A' ? dilemma?.optionA : dilemma?.optionB}
            </div>
          </section>
        )}

        {phase === 'DUEL_REPICK' && (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
            Ri-scegliete: vi siete convinti? 📱
          </p>
        )}

        {phase === 'DUEL_RESULT' && duelResult && (
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {duelResult.agreed ? (
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>
                🤝 Eravate d’accordo
              </p>
            ) : duelResult.convinced.length > 0 ? (
              duelResult.convinced.map((c) => (
                <p key={c.convinced.id} style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.4rem)', fontWeight: 800, margin: 0 }}>
                  <span style={{ color: '#ffd36b' }}>{c.persuader.nickname}</span> ha convinto {c.convinced.nickname}! 🎯
                </p>
              ))
            ) : (
              <p style={{ fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 800, margin: 0 }}>Teste dure! 🪨</p>
            )}
          </section>
        )}

        {phase === 'FINAL_DUEL' && duelSummary && (
          <section
            aria-label="Risultato del duello"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
          >
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {duelSummary.scores.map((s) => (
                <Card
                  key={s.id}
                  glow="accent"
                  style={{ flex: '1 1 12rem', minWidth: '10rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{s.nickname}</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffd36b' }}>{s.persuasions}</span>
                  <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>
                    {s.persuasions === 1 ? 'persuasione' : 'persuasioni'}
                  </span>
                </Card>
              ))}
            </div>
            <p style={{ fontSize: '1.2rem', opacity: 0.85, margin: 0 }}>
              Eravate d’accordo {duelSummary.agreements} {duelSummary.agreements === 1 ? 'volta' : 'volte'}
            </p>
          </section>
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

        {phase !== 'FINAL_AWARDS' && phase !== 'FINAL_DUEL' && (
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
      <img
        src="/schierati-logo.svg"
        alt="SCHIERATI — il gioco dei dilemmi tra amici"
        style={{ width: 'min(82vw, 34rem)', height: 'auto' }}
      />

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
                      opacity: p.connected === false ? 0.5 : 1,
                    }}
                  >
                    {p.isBot && <span aria-label="bot">🤖</span>}
                    {p.nickname}
                    {p.isBot && p.persona && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                    )}
                    {p.connected === false && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }} aria-label="assente">📵</span>
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
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Modalità</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Modalità">
                {GAME_MODES.map((m) => (
                  <Pill
                    key={m}
                    selected={mode === m}
                    onClick={() => setMode(m)}
                    aria-label={`${MODE_LABELS[m].nome}, ${MODE_LABELS[m].descr}`}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                      <span style={{ fontWeight: 700 }}>{MODE_LABELS[m].nome}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{MODE_LABELS[m].descr}</span>
                    </span>
                  </Pill>
                ))}
              </div>
            </div>

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
                {mode === 'duello'
                  ? 'Il 1v1 richiede esattamente 2 giocatori.'
                  : humanCount < 1
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
