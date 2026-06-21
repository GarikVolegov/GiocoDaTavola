import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  VOTE_ERROR_MESSAGES,
  START_ERROR_MESSAGES,
  PHASE_LABELS,
  PERSONA_LABELS,
  OBJECTIVE,
  HOW_TO_PLAY,
  SESSION_FORMATS,
  FORMAT_LABELS,
  FORMAT_DILEMMA_COUNT,
  CONTENT_REGISTERS,
  REGISTER_LABELS,
  MIN_PLAYERS_TO_START,
  GAME_MODES,
  MODE_LABELS,
  REACTIONS,
  REACTION_MIN_INTERVAL_MS,
  type GameMode,
  type SessionFormat,
  type ContentRegister,
  type PlayerJoinedPayload,
  type PlayerJoinErrorPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type HostStartErrorPayload,
  type PublicPlayer,
  type VoteChoice,
  type PlayerVotedPayload,
  type PlayerVoteErrorPayload,
  type PlayerPredictedPayload,
  type PlayerPredictionResultPayload,
  type PlayerSpeakerVotedPayload,
  type Reaction,
  type BlindSpot,
} from '../shared/events';
import { Card, Pill, Button, Alert, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel } from '../shared/ui';
import { useAuth, Show, SignInButton } from '@clerk/react';

// A row of tap-to-send reaction emojis, shown to the audience during a defense /
// duel turn so non-speakers stay engaged. Throttled by the caller.
function ReactionBar({ onReact }: { onReact: (emoji: Reaction) => void }) {
  return (
    <div
      role="group"
      aria-label="Reagisci"
      style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          aria-label={`Reagisci ${emoji}`}
          style={{
            fontSize: '1.8rem',
            lineHeight: 1,
            padding: '0.55rem 0.7rem',
            borderRadius: '999px',
            cursor: 'pointer',
            background: 'rgba(242,243,255,0.08)',
            border: '1px solid rgba(242,243,255,0.18)',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// Read a prefilled room code from the QR join URL (`/join?room=CODE`).
function urlRoom(): string {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
}

// Whether the URL asks to start in "create a room" mode (`/join?create=1`).
function urlWantsCreate(): boolean {
  return new URLSearchParams(window.location.search).get('create') === '1';
}

// Persisted session so a locked/refreshed phone can reclaim its seat + vote.
const SESSION_KEY = 'schierati:session';
interface SavedSession {
  code: string;
  nickname: string;
  token: string;
}
function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SavedSession>;
    return s.code && s.nickname && s.token ? (s as SavedSession) : null;
  } catch {
    return null;
  }
}
function saveSession(s: SavedSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — reconnection just won't persist */
  }
}
function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// The room code to prefill: a QR link wins over any saved session.
function initialCode(): string {
  return urlRoom() || loadSession()?.code || '';
}

// Light haptic feedback where supported (no-op on desktop / unsupported phones).
function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

// Per-player phone view. Shows a join form (code + nickname); once joined,
// shows the realtime lobby roster.
export default function PlayerApp() {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState(() => loadSession()?.nickname ?? '');
  // Create vs. join: default to "create" when arriving via /join?create=1.
  const [mode, setMode] = useState<'join' | 'create'>(() => (urlWantsCreate() ? 'create' : 'join'));
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [blindSpot, setBlindSpot] = useState<BlindSpot | null>(null);
  const [predicted, setPredicted] = useState<VoteChoice | null>(null);
  const [predictionResult, setPredictionResult] = useState<PlayerPredictionResultPayload | null>(null);
  const [speakerVote, setSpeakerVote] = useState<string | null>(null);
  // Leader-only lobby config (mirrors the old HostApp setup).
  const [format, setFormat] = useState<SessionFormat>('classica');
  const [register, setRegister] = useState<ContentRegister>('misto');
  const [gameMode, setGameMode] = useState<GameMode>('gruppo');
  const [startError, setStartError] = useState<string | null>(null);
  // Current credentials, kept in a ref so the socket 'connect' handler can
  // re-claim the seat after a network blip without re-subscribing.
  const credsRef = useRef<SavedSession | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onJoined = ({ code, player, token }: PlayerJoinedPayload) => {
      setJoinedCode(code);
      setPlayerId(player.id);
      setError(null);
      setSubmitting(false);
      const creds: SavedSession = { code, nickname: player.nickname, token };
      credsRef.current = creds;
      saveSession(creds); // persist so a refresh/lock can reconnect
    };
    const onJoinError = ({ error }: PlayerJoinErrorPayload) => {
      setError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
      setSubmitting(false);
      // A stale saved room (server restarted, room gone) — drop it so we don't
      // keep auto-rejoining a dead game.
      if (error === 'ROOM_NOT_FOUND') {
        clearSession();
        credsRef.current = null;
      }
    };
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => {
      setGame(payload);
      setStartError(null);
    };
    const onStartError = ({ error }: HostStartErrorPayload) =>
      setStartError(START_ERROR_MESSAGES[error] ?? 'Impossibile avviare la partita');
    // The server confirms our own current choice (so a refused change reverts).
    const onVoted = ({ choice }: PlayerVotedPayload) => {
      setVote(choice);
      setVoteError(null);
    };
    const onVoteError = ({ error }: PlayerVoteErrorPayload) =>
      setVoteError(VOTE_ERROR_MESSAGES[error] ?? 'Voto non riuscito');
    const onBlindSpot = (tip: BlindSpot) => setBlindSpot(tip);
    socket.on(SocketEvents.PlayerBlindSpot, onBlindSpot);
    const onPredicted = ({ choice }: PlayerPredictedPayload) => setPredicted(choice);
    const onPredictionResult = (payload: PlayerPredictionResultPayload) => setPredictionResult(payload);
    const onSpeakerVoted = ({ defenderId }: PlayerSpeakerVotedPayload) => setSpeakerVote(defenderId);
    socket.on(SocketEvents.PlayerPredicted, onPredicted);
    socket.on(SocketEvents.PlayerPredictionResult, onPredictionResult);
    socket.on(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
    // On every (re)connect, if we hold a token, reclaim the same seat. Covers
    // socket-level reconnects (network blip) without a page reload.
    const onConnect = () => {
      const creds = credsRef.current;
      if (creds) socket.emit(SocketEvents.PlayerJoin, creds);
    };
    socket.on(SocketEvents.PlayerJoined, onJoined);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.LeaderStartError, onStartError);
    socket.on(SocketEvents.PlayerVoted, onVoted);
    socket.on(SocketEvents.PlayerVoteError, onVoteError);
    socket.on('connect', onConnect);

    // Auto-rejoin on mount (page reload / reopened tab): replay the saved token
    // unless a QR link points at a different room (then start a fresh join).
    const saved = loadSession();
    const fromQr = urlRoom();
    if (saved && (!fromQr || fromQr === saved.code)) {
      credsRef.current = saved;
      setSubmitting(true);
      socket.emit(SocketEvents.PlayerJoin, saved);
    }
    return () => {
      socket.off(SocketEvents.PlayerJoined, onJoined);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.LeaderStartError, onStartError);
      socket.off(SocketEvents.PlayerVoted, onVoted);
      socket.off(SocketEvents.PlayerVoteError, onVoteError);
      socket.off(SocketEvents.PlayerBlindSpot, onBlindSpot);
      socket.off(SocketEvents.PlayerPredicted, onPredicted);
      socket.off(SocketEvents.PlayerPredictionResult, onPredictionResult);
      socket.off(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
      socket.off('connect', onConnect);
    };
  }, []);

  // Leave the room on purpose: forget the saved seat and reset to the join form.
  const leaveRoom = () => {
    clearSession();
    credsRef.current = null;
    setJoinedCode(null);
    setPlayerId(null);
    setGame(null);
    setPlayers([]);
    setVote(null);
    setBlindSpot(null);
  };

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote + prediction.
  useEffect(() => {
    setVote(null);
    setVoteError(null);
    setPredicted(null);
    setPredictionResult(null);
    setSpeakerVote(null);
  }, [game?.dilemmaIndex]);

  // When the phone's user is logged in, send the Clerk token so the server can
  // attribute saved awards. Re-runs on login and on (re)joining a room.
  const { isSignedIn, getToken } = useAuth();
  useEffect(() => {
    if (!isSignedIn || !joinedCode) return;
    let cancelled = false;
    void getToken().then((token) => {
      if (token && !cancelled) getSocket().emit(SocketEvents.PlayerIdentify, { token });
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, joinedCode]);

  // Buzz the phone the moment it becomes this player's turn to speak (defense or
  // duel) so they look up from the screen — easy to miss on a shared TV.
  const turnSpeakerId =
    phase === 'DEFENSE'
      ? game?.defense?.speaker?.id ?? null
      : phase === 'DUEL_ARGUE'
        ? game?.duelTurn?.speaker?.id ?? null
        : null;
  const myTurnToSpeak = turnSpeakerId != null && turnSpeakerId === playerId;
  useEffect(() => {
    if (myTurnToSpeak) buzz([60, 40, 60]);
  }, [myTurnToSpeak]);

  const castVote = (choice: VoteChoice) => {
    setVote(choice); // optimistic; reverts via player:voted/voteError
    setVoteError(null);
    buzz(25); // tactile confirm the tap registered
    getSocket().emit(SocketEvents.PlayerVote, { choice });
  };

  const castPrediction = (choice: VoteChoice) => {
    setPredicted(choice); // optimistic; confirmed via player:predicted
    buzz(25);
    getSocket().emit(SocketEvents.PlayerPredict, { choice });
  };

  const castSpeakerVote = (defenderId: string) => {
    setSpeakerVote(defenderId); // optimistic; confirmed via player:speakerVoted
    buzz(25);
    getSocket().emit(SocketEvents.PlayerVoteSpeaker, { defenderId });
  };

  // Live reaction during a defense/duel turn. Throttled client-side to mirror the
  // server's per-player rate limit (avoids spamming rejected emits).
  const lastReactRef = useRef(0);
  const sendReaction = (emoji: Reaction) => {
    const now = Date.now();
    if (now - lastReactRef.current < REACTION_MIN_INTERVAL_MS) return;
    lastReactRef.current = now;
    buzz(15);
    getSocket().emit(SocketEvents.PlayerReact, { emoji });
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

  // Create a brand-new room from this phone; the creator becomes its leader.
  // The server replies with player:joined (same path as a join) — onJoined runs.
  const createRoom = (e: FormEvent) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (!nick) {
      setError(JOIN_ERROR_MESSAGES.NICKNAME_REQUIRED);
      return;
    }
    setError(null);
    setSubmitting(true);
    getSocket().emit(SocketEvents.PlayerCreateRoom, { nickname: nick });
  };

  // This phone holds the leadership when the room's leaderId matches our seat.
  const isLeader = game?.leaderId != null && game.leaderId === playerId;

  // Leader controls (gated server-side; non-leader emits are ignored).
  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.LeaderStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
      mode: gameMode,
    });
  };
  const addBot = () => getSocket().emit(SocketEvents.LeaderAddBot);
  const removeBot = (id: string) => getSocket().emit(SocketEvents.LeaderRemoveBot, { id });
  const advance = () => getSocket().emit(SocketEvents.LeaderAdvancePhase);

  // Gruppo: solo play allowed (1 human + bots), never bots-only. Duello: exactly
  // two humans (no bot opponent). Mirrors the old HostApp start gating.
  const humanCount = players.filter((p) => !p.isBot).length;
  const canStart =
    gameMode === 'duello'
      ? players.length === 2 && humanCount === 2
      : players.length >= MIN_PLAYERS_TO_START && humanCount >= 1;
  const canAddBot = gameMode !== 'duello' && players.length < 8;

  // Phases that run a server-side countdown the leader may skip (everything past
  // the lobby except the terminal award/duel screens).
  const phaseHasTimer = (p: GameStatePayload['phase']) =>
    p !== 'LOBBY' && p !== 'FINAL_AWARDS' && p !== 'FINAL_DUEL';

  // The leader's "skip the rest of this phase" button — only shown to the leader
  // during a phase that has a countdown. Rendered in each in-game branch.
  const skipButton =
    isLeader && phaseHasTimer(phase) ? (
      <button
        type="button"
        onClick={advance}
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          padding: '0.5rem 1.3rem',
          borderRadius: '0.6rem',
          cursor: 'pointer',
        }}
      >
        Salta ▶
      </button>
    ) : null;

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

  if (
    joinedCode &&
    (phase === 'VOTE_1' || phase === 'VOTE_2' || phase === 'DUEL_PICK' || phase === 'DUEL_REPICK')
  ) {
    const dilemma = game?.dilemma;
    // VOTE_2 / DUEL_REPICK keep the player's first choice as the default they can
    // keep or change; the sub-line nudges them per phase.
    const subtitle =
      phase === 'VOTE_2'
        ? 'Hai sentito le difese: confermi o cambi idea?'
        : phase === 'DUEL_PICK'
          ? 'Scegli la tua posizione.'
          : phase === 'DUEL_REPICK'
            ? 'Ti ha convinto? Conferma o cambia.'
            : null;
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>
        {subtitle && (
          <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0 }}>
            {subtitle}
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
            const accent = letter === 'A' ? '84,134,196' : '199,122,69';
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
        {skipButton}
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
            {game?.dilemma && (
              <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
                {game.dilemma.text}
              </p>
            )}
            <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
              Difendi <strong>{speaker.side}</strong>
              {sideOption ? `: ${sideOption}` : ''}
            </p>
            {game?.defense?.spunti && game.defense.spunti.length > 0 && (
              <div style={{ width: 'min(90vw, 22rem)', textAlign: 'left' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.8, margin: '0 0 0.3rem' }}>
                  Spunti per te:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {game.defense.spunti.map((s, i) => (
                    <li key={`${i}-${s}`} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: '1.3rem', margin: 0 }}>
              Sta parlando <strong>{speaker.nickname}</strong> 🎤
            </p>
            <ReactionBar onReact={sendReaction} />
          </>
        )}
        {skipButton}
      </main>
    );
  }

  if (joinedCode && phase === 'DUEL_ARGUE') {
    const speaker = game?.duelTurn?.speaker ?? null;
    const myTurn = speaker != null && speaker.id === playerId;
    const sideOption = speaker
      ? speaker.side === 'A'
        ? game?.dilemma?.optionA
        : game?.dilemma?.optionB
      : undefined;
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DUEL_ARGUE}</h1>
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        {myTurn ? (
          <>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
            {game?.dilemma && (
              <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
                {game.dilemma.text}
              </p>
            )}
            <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
              Argomenta <strong>{speaker.side}</strong>
              {sideOption ? `: ${sideOption}` : ''}
            </p>
          </>
        ) : speaker ? (
          <>
            <p style={{ fontSize: '1.3rem', margin: 0 }}>
              Sta argomentando <strong>{speaker.nickname}</strong> 🎤
            </p>
            <ReactionBar onReact={sendReaction} />
          </>
        ) : (
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>Guarda lo schermo condiviso.</p>
        )}
        {skipButton}
      </main>
    );
  }

  if (joinedCode && phase === 'SPEAKER_VOTE') {
    const candidates = (game?.speakerCandidates ?? []).filter((d) => d.id !== playerId);
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.SPEAKER_VOTE}</h1>
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
          Chi è stato più convincente?
        </p>
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        {candidates.length === 0 ? (
          <p style={{ opacity: 0.8, margin: 0 }}>Hai parlato tu: guarda lo schermo.</p>
        ) : (
          <div
            role="group"
            aria-label="Il tuo voto al miglior oratore"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
          >
            {candidates.map((d) => {
              const selected = speakerVote === d.id;
              const accent = d.side === 'A' ? '84,134,196' : '199,122,69';
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => castSpeakerVote(d.id)}
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
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, opacity: 0.85 }}>{d.side}</span>
                  <span style={{ fontSize: '1.1rem' }}>{d.nickname}</span>
                </button>
              );
            })}
          </div>
        )}
        {speakerVote && (
          <p style={{ opacity: 0.8, margin: 0 }}>Voto registrato. Puoi cambiare finché c’è tempo.</p>
        )}
        {skipButton}
      </main>
    );
  }

  if (joinedCode && phase === 'PREDICT') {
    const dilemma = game?.dilemma;
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.PREDICT}</h1>
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
          Chi vincerà <em>dopo</em> le difese?
        </p>
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        <div
          role="group"
          aria-label="Il tuo pronostico"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
        >
          {(['A', 'B'] as const).map((letter) => {
            const selected = predicted === letter;
            const accent = letter === 'A' ? '84,134,196' : '199,122,69';
            return (
              <button
                key={letter}
                type="button"
                onClick={() => castPrediction(letter)}
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
        {predicted ? (
          <p style={{ opacity: 0.8, margin: 0 }}>
            Hai pronosticato <strong>{predicted}</strong>. Vediamo se indovini!
          </p>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Scegli chi pensi convincerà di più.</p>
        )}
        {skipButton}
      </main>
    );
  }

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
        {phase === 'PHASE_INTRO' ? (
          <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, maxWidth: '22rem' }}>
            🎯 {OBJECTIVE}
          </p>
        ) : phase === 'DILEMMA_REVEAL' ? (
          game?.dilemma && <DilemmaCard dilemma={game.dilemma} />
        ) : phase === 'SPLIT_REVEAL' ? (
          <>
            {game?.split && <SplitBar split={game.split} />}
            {game?.dilemma && <DilemmaCard dilemma={game.dilemma} />}
          </>
        ) : phase === 'PHASE_RESULTS' ? (
          <>
            {game?.swing && <ResultsPanel swing={game.swing} />}
            {predictionResult && (
              <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {predictionResult.actual == null
                  ? '🔮 Pareggio: nessun pronostico vince.'
                  : predictionResult.correct
                    ? '✅ Pronostico azzeccato!'
                    : '❌ Stavolta non ci hai preso.'}
              </p>
            )}
          </>
        ) : phase === 'FINAL_AWARDS' ? (
          <>
            {game?.awards && <AwardsPanel awards={game.awards} />}
            {blindSpot && (
              <Card
                glow="accent"
                style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}
              >
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🔭 Il tuo punto cieco</h3>
                <p style={{ margin: 0, fontWeight: 700 }}>{blindSpot.title}</p>
                <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>{blindSpot.advice}</p>
              </Card>
            )}
            <Show when="signed-out">
              <p style={{ fontSize: '1rem', opacity: 0.85, margin: '0.4rem 0 0' }}>
                Accedi per salvare i tuoi premi.
              </p>
              <SignInButton mode="modal">
                <button
                  type="button"
                  style={{ marginTop: '0.5rem', fontWeight: 700, padding: '0.6rem 1.4rem', borderRadius: '0.7rem', cursor: 'pointer' }}
                >
                  Accedi e salva
                </button>
              </SignInButton>
            </Show>
          </>
        ) : phase === 'FINAL_DUEL' ? (
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Guarda il risultato sullo schermo!
          </p>
        ) : (
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
            Guarda lo schermo condiviso.
          </p>
        )}
        {skipButton}
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
          {players.map((p) => {
            const absent = p.connected === false;
            return (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '0.6rem',
                  background: p.isBot ? 'rgba(192,79,255,0.18)' : 'rgba(127,127,127,0.18)',
                  fontWeight: 600,
                  opacity: absent ? 0.5 : 1,
                }}
              >
                <span>{p.isBot ? '🤖 ' : ''}{p.nickname}</span>
                {p.isBot && p.persona && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                )}
                {absent && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>· assente 📵</span>}
                {isLeader && p.isBot && (
                  <button
                    type="button"
                    onClick={() => removeBot(p.id)}
                    aria-label={`Rimuovi ${p.nickname}`}
                    style={{
                      marginLeft: 'auto',
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
            );
          })}
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

        {isLeader ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}
          >
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Sei il leader — componi la serata</h3>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Modalità</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Modalità">
                {GAME_MODES.map((m) => (
                  <Pill
                    key={m}
                    selected={gameMode === m}
                    onClick={() => setGameMode(m)}
                    aria-label={`${MODE_LABELS[m].nome}, ${MODE_LABELS[m].descr}`}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                      <span style={{ fontWeight: 700 }}>{MODE_LABELS[m].nome}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{MODE_LABELS[m].descr}</span>
                    </span>
                  </Pill>
                ))}
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Argomenti</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Registro">
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
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Formato">
                {SESSION_FORMATS.map((f) => (
                  <Pill
                    key={f}
                    selected={format === f}
                    onClick={() => setFormat(f)}
                    aria-label={`${FORMAT_LABELS[f].nome}, ${FORMAT_LABELS[f].round} round, ${FORMAT_LABELS[f].durata}`}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                      <span style={{ fontWeight: 700 }}>{FORMAT_LABELS[f].nome}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {FORMAT_LABELS[f].round} round · {FORMAT_LABELS[f].durata}
                      </span>
                    </span>
                  </Pill>
                ))}
              </div>
            </div>

            <Button variant="ghost" onClick={addBot} disabled={!canAddBot}>
              + Aggiungi bot 🤖
            </Button>

            <Button variant="primary" size="lg" onClick={startGame} disabled={!canStart}>
              Avvia partita
            </Button>
            {!canStart && (
              <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>
                {gameMode === 'duello'
                  ? 'Il 1v1 richiede esattamente 2 giocatori.'
                  : humanCount < 1
                    ? 'Serve almeno una persona (i bot da soli non bastano).'
                    : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi giocatori o bot 🤖`}
              </p>
            )}
            {startError && <Alert>{startError}</Alert>}
          </Card>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>In attesa che il leader avvii la partita…</p>
        )}
        <button
          type="button"
          onClick={leaveRoom}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            opacity: 0.55,
            fontSize: '0.85rem',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Esci dalla stanza
        </button>
      </main>
    );
  }

  const creating = mode === 'create';
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>
        {creating ? 'Crea una partita' : 'Entra nella partita'}
      </h1>
      <p style={{ opacity: 0.7, margin: 0 }}>
        {creating
          ? 'Scegli il tuo nome: sarai il leader della stanza.'
          : 'Inserisci il codice e il tuo nome.'}
      </p>
      <form
        onSubmit={creating ? createRoom : handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          width: 'min(90vw, 22rem)',
        }}
      >
        {!creating && (
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
        )}
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
          {submitting ? (creating ? 'Creo…' : 'Entro…') : creating ? 'Crea stanza' : 'Entra'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setMode(creating ? 'join' : 'create');
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          opacity: 0.7,
          fontSize: '0.9rem',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {creating ? 'Hai un codice? Entra' : 'Vuoi creare una stanza?'}
      </button>
    </main>
  );
}
