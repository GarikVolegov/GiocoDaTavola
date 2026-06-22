import { useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import { useElapsed } from '../shared/useElapsed';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  VOTE_ERROR_MESSAGES,
  START_ERROR_MESSAGES,
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
  TAPPE,
  DURATE,
  DURATA_LABELS,
  estimatePercorsoDilemmi,
  type Durata,
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
  type SwingBet,
  type PlayerSwingBettedPayload,
  type PlayerSwingBetResultPayload,
  type PlayerSpeakerVotedPayload,
  type Reaction,
  type BlindSpot,
  MAX_SUBMISSIONS_PER_PLAYER,
  MIN_INFILTRATO_HUMANS,
  MIN_SQUADRE_PLAYERS,
  SUBMIT_DILEMMA_ERROR_MESSAGES,
  type PlayerDilemmaSubmittedPayload,
  type PlayerSubmitDilemmaErrorPayload,
  type PlayerKnowGuessedPayload,
  type PlayerKnowGuessResultPayload,
  type PlayerInfiltratoRolePayload,
  type PlayerAccusedPayload,
} from '../shared/events';
import { Card, Pill, Button, Alert, JoinQr } from '../shared/ui';
import { useAuth } from '@clerk/react';
import VoteView from './views/VoteView';
import SpeakerVoteView from './views/SpeakerVoteView';
import AccuseView from './views/AccuseView';
import DefenseView from './views/DefenseView';
import PredictView from './views/PredictView';
import DuelArgueView from './views/DuelArgueView';
import StatusView from './views/StatusView';
import { wrap } from './views/layout';


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
  const [swingBet, setSwingBet] = useState<SwingBet | null>(null);
  const [swingBetResult, setSwingBetResult] = useState<PlayerSwingBetResultPayload | null>(null);
  const [knowGuess, setKnowGuess] = useState<VoteChoice | null>(null);
  const [knowResult, setKnowResult] = useState<PlayerKnowGuessResultPayload | null>(null);
  const [infiltratoRole, setInfiltratoRole] = useState<PlayerInfiltratoRolePayload | null>(null);
  const [myAccusation, setMyAccusation] = useState<string | null>(null);
  const [speakerVote, setSpeakerVote] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  // Player-written dilemmas (lobby): the draft form + how many we've added.
  const [dilemmaText, setDilemmaText] = useState('');
  const [dilemmaA, setDilemmaA] = useState('');
  const [dilemmaB, setDilemmaB] = useState('');
  const [mySubmitted, setMySubmitted] = useState(0);
  const [submitDilemmaError, setSubmitDilemmaError] = useState<string | null>(null);
  // Leader-only lobby config (mirrors the old HostApp setup).
  const [format, setFormat] = useState<SessionFormat>('classica');
  const [register, setRegister] = useState<ContentRegister>('misto');
  const [gameMode, setGameMode] = useState<GameMode>('gruppo');
  const [infiltratoOn, setInfiltratoOn] = useState(false);
  const [squadreOn, setSquadreOn] = useState(false);
  // "Percorso": the long themed ascent (gruppo-only). When on, the classic
  // register/durata pickers are replaced by a start-tappa + duration choice.
  const [percorsoOn, setPercorsoOn] = useState(false);
  const [startTappa, setStartTappa] = useState(1);
  const [durata, setDurata] = useState<Durata>('medio');
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
    const onSwingBetted = ({ bet }: PlayerSwingBettedPayload) => setSwingBet(bet);
    const onSwingBetResult = (payload: PlayerSwingBetResultPayload) => setSwingBetResult(payload);
    const onKnowGuessed = ({ choice }: PlayerKnowGuessedPayload) => setKnowGuess(choice);
    const onKnowGuessResult = (payload: PlayerKnowGuessResultPayload) => setKnowResult(payload);
    const onInfiltratoRole = (payload: PlayerInfiltratoRolePayload) => setInfiltratoRole(payload);
    const onAccused = ({ accusedId }: PlayerAccusedPayload) => setMyAccusation(accusedId);
    const onSpeakerVoted = ({ defenderId }: PlayerSpeakerVotedPayload) => setSpeakerVote(defenderId);
    const onHandRaised = ({ raised }: { raised: boolean }) => setHandRaised(raised);
    const onDilemmaSubmitted = ({ count }: PlayerDilemmaSubmittedPayload) => {
      setMySubmitted(count);
      setSubmitDilemmaError(null);
      setDilemmaText('');
      setDilemmaA('');
      setDilemmaB('');
    };
    const onSubmitDilemmaError = ({ error }: PlayerSubmitDilemmaErrorPayload) =>
      setSubmitDilemmaError(SUBMIT_DILEMMA_ERROR_MESSAGES[error] ?? 'Dilemma non valido');
    socket.on(SocketEvents.PlayerPredicted, onPredicted);
    socket.on(SocketEvents.PlayerPredictionResult, onPredictionResult);
    socket.on(SocketEvents.PlayerSwingBetted, onSwingBetted);
    socket.on(SocketEvents.PlayerSwingBetResult, onSwingBetResult);
    socket.on(SocketEvents.PlayerKnowGuessed, onKnowGuessed);
    socket.on(SocketEvents.PlayerKnowGuessResult, onKnowGuessResult);
    socket.on(SocketEvents.PlayerInfiltratoRole, onInfiltratoRole);
    socket.on(SocketEvents.PlayerAccused, onAccused);
    socket.on(SocketEvents.PlayerDilemmaSubmitted, onDilemmaSubmitted);
    socket.on(SocketEvents.PlayerSubmitDilemmaError, onSubmitDilemmaError);
    socket.on(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
    socket.on(SocketEvents.PlayerHandRaised, onHandRaised);
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
      socket.off(SocketEvents.PlayerSwingBetted, onSwingBetted);
      socket.off(SocketEvents.PlayerSwingBetResult, onSwingBetResult);
      socket.off(SocketEvents.PlayerKnowGuessed, onKnowGuessed);
      socket.off(SocketEvents.PlayerKnowGuessResult, onKnowGuessResult);
      socket.off(SocketEvents.PlayerInfiltratoRole, onInfiltratoRole);
      socket.off(SocketEvents.PlayerAccused, onAccused);
      socket.off(SocketEvents.PlayerDilemmaSubmitted, onDilemmaSubmitted);
      socket.off(SocketEvents.PlayerSubmitDilemmaError, onSubmitDilemmaError);
      socket.off(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
      socket.off(SocketEvents.PlayerHandRaised, onHandRaised);
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
  // Self-paced turn (DEFENSE/INTERVENTI): the floor countdown gates "Ho finito".
  const minRemaining = useCountdown(game?.defense?.minEndsAt ?? null);
  const canFinishNow = game?.defense?.minEndsAt == null || (minRemaining ?? 0) <= 0;
  // The speaker's elapsed time, counting UP from the turn start.
  const speakerElapsed = useElapsed(game?.defense?.startedAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote + prediction.
  useEffect(() => {
    setVote(null);
    setVoteError(null);
    setPredicted(null);
    setPredictionResult(null);
    setSwingBet(null);
    setSwingBetResult(null);
    setKnowGuess(null);
    setKnowResult(null);
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
    phase === 'DEFENSE' || phase === 'INTERVENTI'
      ? game?.defense?.speakerId ?? null
      : phase === 'DUEL_ARGUE'
        ? game?.duelTurn?.speaker?.id ?? null
        : null;
  const myTurnToSpeak = turnSpeakerId != null && turnSpeakerId === playerId;
  useEffect(() => {
    if (myTurnToSpeak) buzz([60, 40, 60]);
  }, [myTurnToSpeak]);

  // A stale "raised" must never stick across turns/phases: the server clears the
  // raised-hand queue at the start of each defender turn, so mirror that locally.
  useEffect(() => {
    setHandRaised(false);
  }, [turnSpeakerId, phase]);

  const castVote = (choice: VoteChoice) => {
    setVote(choice); // optimistic; reverts via player:voted/voteError
    setVoteError(null);
    buzz(25); // tactile confirm the tap registered
    getSocket().emit(SocketEvents.PlayerVote, { choice });
  };

  const castSwingBet = (bet: SwingBet) => {
    setSwingBet(bet); // optimistic; confirmed via player:swingBetted
    buzz(25);
    getSocket().emit(SocketEvents.PlayerSwingBet, { bet });
  };

  const castKnowGuess = (choice: VoteChoice) => {
    setKnowGuess(choice); // optimistic; confirmed via player:knowGuessed
    buzz(25);
    getSocket().emit(SocketEvents.PlayerKnowGuess, { choice });
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

  // Raise/lower the hand to queue for an intervention (server is the source of
  // truth; the echo sets handRaised). End the current self-paced turn ("Ho finito").
  const toggleHand = () => {
    buzz(15);
    getSocket().emit(SocketEvents.PlayerRaiseHand);
  };
  const sendFinish = () => {
    buzz(25);
    getSocket().emit(SocketEvents.PlayerFinishTurn);
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
    // Percorso is a gruppo-only experience; it carries its own config (start tappa
    // + duration) and the server derives the dilemma count from the planned ascent.
    if (percorsoOn) {
      getSocket().emit(SocketEvents.LeaderStartGame, {
        format: 'percorso',
        startTappa,
        durata,
        mode: 'gruppo',
        infiltrato: infiltratoOn,
        squadre: squadreOn,
      });
      return;
    }
    getSocket().emit(SocketEvents.LeaderStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
      mode: gameMode,
      infiltrato: gameMode === 'gruppo' && infiltratoOn,
      squadre: gameMode === 'gruppo' && squadreOn,
    });
  };
  const castAccuse = (accusedId: string) => {
    setMyAccusation(accusedId); // optimistic; confirmed via player:accused
    buzz(25);
    getSocket().emit(SocketEvents.PlayerAccuse, { accusedId });
  };
  const addBot = () => getSocket().emit(SocketEvents.LeaderAddBot);
  const removeBot = (id: string) => getSocket().emit(SocketEvents.LeaderRemoveBot, { id });
  const advance = () => getSocket().emit(SocketEvents.LeaderAdvancePhase);

  const submitDilemma = () => {
    buzz(15);
    getSocket().emit(SocketEvents.PlayerSubmitDilemma, {
      text: dilemmaText,
      optionA: dilemmaA,
      optionB: dilemmaB,
    });
  };
  const canSubmitDilemma =
    mySubmitted < MAX_SUBMISSIONS_PER_PLAYER &&
    dilemmaText.trim() !== '' &&
    dilemmaA.trim() !== '' &&
    dilemmaB.trim() !== '';
  const dilemmaFieldStyle: CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.7rem',
    borderRadius: '0.6rem',
    border: '1px solid rgba(242,243,255,0.18)',
    background: 'rgba(242,243,255,0.06)',
    color: 'inherit',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
  };

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
    p !== 'LOBBY' && p !== 'FINAL_AWARDS' && p !== 'FINAL_DUEL' && p !== 'TAPPA_RECAP';

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

  if (
    joinedCode &&
    (phase === 'VOTE_1' || phase === 'VOTE_2' || phase === 'DUEL_PICK' || phase === 'DUEL_REPICK')
  ) {
    return (
      <VoteView
        phase={phase}
        dilemma={game?.dilemma}
        remaining={remaining}
        vote={vote}
        voteError={voteError}
        onVote={castVote}
        onConfirm={() => getSocket().emit(SocketEvents.PlayerConfirmVote)}
        confirmedCount={game?.confirmedCount ?? 0}
        playerCount={players.length}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && (phase === 'DEFENSE' || phase === 'INTERVENTI')) {
    return (
      <DefenseView
        phase={phase}
        defense={game?.defense ?? null}
        dilemma={game?.dilemma}
        isDevilRound={game?.isDevilRound ?? false}
        playerId={playerId}
        handRaised={handRaised}
        canFinishNow={canFinishNow}
        minRemaining={minRemaining}
        remaining={remaining}
        speakerElapsed={speakerElapsed}
        onFinish={sendFinish}
        onToggleHand={toggleHand}
        onReact={sendReaction}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'DUEL_ARGUE') {
    return (
      <DuelArgueView
        speaker={game?.duelTurn?.speaker}
        dilemma={game?.dilemma}
        playerId={playerId}
        remaining={remaining}
        onReact={sendReaction}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'SPEAKER_VOTE') {
    const candidates = (game?.speakerCandidates ?? []).filter((d) => d.id !== playerId);
    return (
      <SpeakerVoteView
        candidates={candidates}
        remaining={remaining}
        speakerVote={speakerVote}
        onVote={castSpeakerVote}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'PREDICT') {
    return (
      <PredictView
        dilemma={game?.dilemma}
        knowPair={game?.knowPairs?.find((p) => p.guesserId === playerId) ?? null}
        remaining={remaining}
        predicted={predicted}
        swingBet={swingBet}
        knowGuess={knowGuess}
        onPredict={castPrediction}
        onSwingBet={castSwingBet}
        onKnowGuess={castKnowGuess}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'ACCUSE') {
    const candidates = players.filter((p) => p.id !== playerId);
    return (
      <AccuseView
        candidates={candidates}
        remaining={remaining}
        myAccusation={myAccusation}
        onAccuse={castAccuse}
      />
    );
  }

  if (joinedCode && phase !== 'LOBBY') {
    return (
      <StatusView
        phase={phase}
        game={game}
        remaining={remaining}
        playerId={playerId}
        isLeader={isLeader}
        onAdvance={advance}
        infiltratoRole={infiltratoRole}
        predictionResult={predictionResult}
        swingBetResult={swingBetResult}
        knowResult={knowResult}
        blindSpot={blindSpot}
        skipButton={skipButton}
      />
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <JoinQr code={joinedCode} />
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            Fai inquadrare il QR per entrare — oppure detta il codice
          </p>
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
                  background: p.isBot ? 'var(--gold-soft)' : 'rgba(127,127,127,0.18)',
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

        <Card
          style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.55rem', textAlign: 'left' }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>✍️ Aggiungi un dilemma</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
            I vostri dilemmi entrano in gioco per primi · {game?.submittedCount ?? 0} dal gruppo
          </p>
          {mySubmitted >= MAX_SUBMISSIONS_PER_PLAYER ? (
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.9 }}>
              Hai aggiunto {mySubmitted} dilemmi. Grazie! 🙌
            </p>
          ) : (
            <>
              <input
                aria-label="La domanda"
                placeholder="La domanda (es. Mare o montagna?)"
                value={dilemmaText}
                onChange={(e) => setDilemmaText(e.target.value)}
                style={dilemmaFieldStyle}
              />
              <input
                aria-label="Opzione A"
                placeholder="Opzione A"
                value={dilemmaA}
                onChange={(e) => setDilemmaA(e.target.value)}
                style={dilemmaFieldStyle}
              />
              <input
                aria-label="Opzione B"
                placeholder="Opzione B"
                value={dilemmaB}
                onChange={(e) => setDilemmaB(e.target.value)}
                style={dilemmaFieldStyle}
              />
              <Button variant="ghost" onClick={submitDilemma} disabled={!canSubmitDilemma}>
                Aggiungi dilemma{mySubmitted > 0 ? ` (${mySubmitted}/${MAX_SUBMISSIONS_PER_PLAYER})` : ''}
              </Button>
              {submitDilemmaError && <Alert>{submitDilemmaError}</Alert>}
            </>
          )}
        </Card>

        {isLeader ? (
          <Card
            glow="accent"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}
          >
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Sei il leader — componi la serata</h3>

            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Tipo di partita</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tipo di partita">
                <Pill selected={!percorsoOn} onClick={() => setPercorsoOn(false)} aria-label="Classica: 3, 5 o 7 dilemmi">
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>Classica</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>3 · 5 · 7 dilemmi</span>
                  </span>
                </Pill>
                <Pill
                  selected={percorsoOn}
                  onClick={() => {
                    setPercorsoOn(true);
                    setGameMode('gruppo');
                  }}
                  aria-label="Percorso: salita a tappe, 1-3 ore"
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>🧗 Percorso</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>salita a tappe · 1–3h</span>
                  </span>
                </Pill>
              </div>
            </div>

            {!percorsoOn && (
              <>
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
              </>
            )}

            {percorsoOn && (
              <>
                <div style={{ width: '100%' }}>
                  <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Tappa di partenza</p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tappa di partenza">
                    {TAPPE.map((t) => (
                      <Pill
                        key={t.id}
                        selected={startTappa === t.id}
                        onClick={() => setStartTappa(t.id)}
                        aria-label={`${t.nome}: ${t.sottotitolo}`}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                          <span style={{ fontWeight: 700 }}>{t.emoji} {t.nome}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.sottotitolo}</span>
                        </span>
                      </Pill>
                    ))}
                  </div>
                  <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                    Si sale fino a 🌅 I Bilanci.
                  </p>
                </div>

                <div style={{ width: '100%' }}>
                  <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Durata percorso">
                    {DURATE.map((d) => (
                      <Pill
                        key={d}
                        selected={durata === d}
                        onClick={() => setDurata(d)}
                        aria-label={`${DURATA_LABELS[d].nome}, ${DURATA_LABELS[d].durata}`}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                          <span style={{ fontWeight: 700 }}>{DURATA_LABELS[d].nome}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{DURATA_LABELS[d].durata}</span>
                        </span>
                      </Pill>
                    ))}
                  </div>
                  <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                    ~{estimatePercorsoDilemmi(game?.tappaCounts, startTappa, durata)} dilemmi · {DURATA_LABELS[durata].durata}
                  </p>
                </div>
              </>
            )}

            {(percorsoOn || gameMode === 'gruppo') && (
              <div style={{ width: '100%' }}>
                <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Modalità speciale</p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Pill
                    selected={infiltratoOn}
                    onClick={() => {
                      setInfiltratoOn((v) => !v);
                      setSquadreOn(false);
                    }}
                    aria-label="L'Infiltrato (un giocatore segreto)"
                  >
                    🕵️ L'Infiltrato {infiltratoOn ? 'ON' : 'OFF'}
                  </Pill>
                  <Pill
                    selected={squadreOn}
                    onClick={() => {
                      setSquadreOn((v) => !v);
                      setInfiltratoOn(false);
                    }}
                    aria-label="Squadre (Blu contro Arancio)"
                  >
                    🔵🟠 Squadre {squadreOn ? 'ON' : 'OFF'}
                  </Pill>
                </div>
                <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                  {squadreOn
                    ? `Blu contro Arancio: vince chi convince di più · servono ≥${MIN_SQUADRE_PLAYERS} giocatori`
                    : `Un giocatore segreto deve ribaltare il gruppo · servono ≥${MIN_INFILTRATO_HUMANS} persone`}
                </p>
              </div>
            )}

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
