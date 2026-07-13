import { useEffect, useRef, useState, lazy, Suspense, type FormEvent, type ReactNode } from 'react';
import { getSocket } from '../shared/socket';
import { fetchWithTimeout } from '../shared/api';
import { useCountdown } from '../shared/useCountdown';
import { useElapsed } from '../shared/useElapsed';
import { useTransient } from '../shared/useTransient';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  VOTE_ERROR_MESSAGES,
  START_ERROR_MESSAGES,
  PERSONA_LABELS,
  OBJECTIVE,
  HOW_TO_PLAY,
  FORMAT_DILEMMA_COUNT,
  MIN_PLAYERS_TO_START,
  type Durata,
  REACTION_MIN_INTERVAL_MS,
  type GameMode,
  type SessionFormat,
  type ContentRegister,
  type Mood,
  type Caos,
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
  SUBMIT_DILEMMA_ERROR_MESSAGES,
  type PlayerDilemmaSubmittedPayload,
  type PlayerSubmitDilemmaErrorPayload,
  type PlayerKnowGuessedPayload,
  type PlayerKnowGuessResultPayload,
  type PlayerGroupMindSubmittedPayload,
  type PlayerGroupMindResultPayload,
  type PlayerWriteSubmittedPayload,
  type PlayerWriteVotedPayload,
  type PlayerMyWriteTokenPayload,
  type PlayerInfiltratoRolePayload,
  type PlayerInfiltratoToolErrorPayload,
  type PlayerAccusedPayload,
  type MyProfile,
  type RaiseHandError,
  RAISE_HAND_ERROR_MESSAGES,
  INFILTRATO_TOOL_ERROR_MESSAGES,
} from '../shared/events';
import { Card, JoinQr, Button, Field, TextInput, Alert, ShareInviteButton, PauseOverlay } from '../shared/ui';
import { useHostAudio } from '../host/audio/useHostAudio';
import { useSfxCues } from '../host/audio/useSfxCues';
import { MuteButton } from '../host/MuteButton';
import { AudioGate } from '../host/AudioGate';
// Lazy so jsQR (the camera decoder) only loads when a player actually opens the scanner.
const QrScanner = lazy(() => import('./QrScanner').then((m) => ({ default: m.QrScanner })));
import { useAuth } from '@clerk/react';
import VoteView from './views/VoteView';
import SpeakerVoteView from './views/SpeakerVoteView';
import AccuseView from './views/AccuseView';
import DefenseView from './views/DefenseView';
import PredictView from './views/PredictView';
import GroupMindView from './views/GroupMindView';
import WriteView from './views/WriteView';
import WriteVoteView from './views/WriteVoteView';
import DuoArgueView from './views/DuoArgueView';
import PickPredictView from './views/PickPredictView';
import WaverView from './views/WaverView';
import PortraitView from './views/PortraitView';
import StatusView from './views/StatusView';
import LeaveGameMenu from './LeaveGameMenu';
import SubmitDilemmaCard from './views/SubmitDilemmaCard';
import LeaderSetup, { type TipoPartita } from './views/LeaderSetup';
import { getSeenDilemmaIds, addSeenDilemmaIds } from '../shared/seenDilemmas';
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
  // Whether the camera QR reader overlay is open (join-by-scan).
  const [showScanner, setShowScanner] = useState(false);
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [vote, setVote] = useState<VoteChoice | null>(null);
  // Whether the player has explicitly confirmed their second vote (VOTE_2). Local
  // only: the server reports just the aggregate count, so this drives the personal
  // "you confirmed — waiting for the others" feedback on this phone.
  const [confirmed, setConfirmed] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [blindSpot, setBlindSpot] = useState<BlindSpot | null>(null);
  const [predicted, setPredicted] = useState<VoteChoice | null>(null);
  const [predictionResult, setPredictionResult] = useState<PlayerPredictionResultPayload | null>(null);
  const [swingBet, setSwingBet] = useState<SwingBet | null>(null);
  const [swingBetResult, setSwingBetResult] = useState<PlayerSwingBetResultPayload | null>(null);
  const [knowGuess, setKnowGuess] = useState<VoteChoice | null>(null);
  const [knowResult, setKnowResult] = useState<PlayerKnowGuessResultPayload | null>(null);
  const [groupMindAnswer, setGroupMindAnswer] = useState<VoteChoice | null>(null);
  const [groupMindGuess, setGroupMindGuess] = useState<VoteChoice | null>(null);
  const [groupMindResult, setGroupMindResult] = useState<PlayerGroupMindResultPayload | null>(null);
  const [writeText, setWriteText] = useState('');
  const [writeSubmitted, setWriteSubmitted] = useState<string | null>(null);
  const [writeVotedForToken, setWriteVotedForToken] = useState<string | null>(null);
  // This player's own answer's opaque token this round (private emit on
  // entering WRITE_VOTE / on reconnect) — used to filter our own entry out
  // of the anonymized list without ever comparing real player ids.
  const [myWriteToken, setMyWriteToken] = useState<string | null>(null);
  const [infiltratoRole, setInfiltratoRole] = useState<PlayerInfiltratoRolePayload | null>(null);
  const [infiltratoToolError, setInfiltratoToolError] = useState<string | null>(null);
  const [myAccusation, setMyAccusation] = useState<string | null>(null);
  const [speakerVote, setSpeakerVote] = useState<string | null>(null);
  // Percorso in 2 (Atto I): the two-part secret submission — own pick + the
  // prediction of the partner's — and whether the combined emit was echoed.
  const [duoOwn, setDuoOwn] = useState<VoteChoice | null>(null);
  const [duoPredict, setDuoPredict] = useState<VoteChoice | null>(null);
  const [duoSynced, setDuoSynced] = useState(false);
  // Percorso in 2 (DUO_WAVER): this phone's secret "ti ha fatto vacillare?" rating.
  const [duoRating, setDuoRating] = useState<0 | 1 | 2 | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [raiseHandError, setRaiseHandError] = useState<string | null>(null);
  // Two-step guard on the lobby's "leave room" link: the first tap arms it, the
  // second actually leaves — so a stray tap never drops the player out of the room.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // "Salta ▶" needs a 2nd tap during a secret-vote phase (VOTE_1/VOTE_2/
  // PREDICT/SPEAKER_VOTE/DUO_PICK/DUO_REPICK) so an impatient leader can't
  // silently cut off someone else's still-forming vote with one stray tap.
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  // "Scarta dilemma" needs its own 2nd-tap guard once someone has already cast
  // a secret vote — tossing the dilemma throws that vote away.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Brief everyone-sees-it toast when the leader tosses the dilemma.
  const [dilemmaSkippedToast, setDilemmaSkippedToast] = useState(false);
  // Player-written dilemmas (lobby): the draft form + how many we've added.
  const [dilemmaText, setDilemmaText] = useState('');
  const [dilemmaA, setDilemmaA] = useState('');
  const [dilemmaB, setDilemmaB] = useState('');
  const [mySubmitted, setMySubmitted] = useState(0);
  const [submitDilemmaError, setSubmitDilemmaError] = useState<string | null>(null);
  // Leader-only lobby config (mirrors the old HostApp setup).
  const [format, setFormat] = useState<SessionFormat>('classica');
  const [register, setRegister] = useState<ContentRegister>('misto');
  const [mood, setMood] = useState<Mood>('mista');
  const [caos, setCaos] = useState<Caos>('assente');
  const [delicatoOptIn, setDelicatoOptIn] = useState(false);
  const [serataLunga, setSerataLunga] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('gruppo');
  const [infiltratoOn, setInfiltratoOn] = useState(false);
  const [squadreOn, setSquadreOn] = useState(false);
  // Which kind of evening: classica (3/5/7), percorso (themed ascent), or storia
  // (narrative tale). Percorso/storia are gruppo-only and replace the classic
  // register/durata pickers with their own config.
  const [tipoPartita, setTipoPartita] = useState<TipoPartita>('classica');
  const [startTappa, setStartTappa] = useState(1);
  const [durata, setDurata] = useState<Durata>('medio');
  // "Storia": the chosen story id (from the server's static catalog).
  const [storyId, setStoryId] = useState<string>('');
  const [startError, setStartError] = useState<string | null>(null);
  // Current credentials, kept in a ref so the socket 'connect' handler can
  // re-claim the seat after a network blip without re-subscribing.
  const credsRef = useRef<SavedSession | null>(null);
  // Was the in-flight join triggered by the user pressing a form button? Only
  // then should a join failure surface as a form error. Background replays
  // (auto-rejoin on mount, reconnect after a blip) of a now-dead saved room must
  // recover silently — otherwise a stale "Codice stanza non valido" pops up on
  // the create/join screen for a room the user never tried to enter.
  const userInitiatedRef = useRef(false);

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
      setSubmitting(false);
      // Only show the error if the user actually pressed Entra/Crea; a failed
      // background replay just recovers silently below.
      if (userInitiatedRef.current) {
        setError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
      }
      userInitiatedRef.current = false;
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
    const onGroupMindSubmitted = ({ answer, guess }: PlayerGroupMindSubmittedPayload) => {
      setGroupMindAnswer(answer);
      setGroupMindGuess(guess);
    };
    const onGroupMindResult = (payload: PlayerGroupMindResultPayload) => setGroupMindResult(payload);
    const onWriteSubmitted = ({ text }: PlayerWriteSubmittedPayload) => setWriteSubmitted(text);
    const onWriteVoted = ({ votedForToken }: PlayerWriteVotedPayload) => setWriteVotedForToken(votedForToken);
    const onMyWriteToken = ({ token }: PlayerMyWriteTokenPayload) => setMyWriteToken(token);
    const onInfiltratoRole = (payload: PlayerInfiltratoRolePayload) => setInfiltratoRole(payload);
    const onInfiltratoToolError = ({ error }: PlayerInfiltratoToolErrorPayload) =>
      setInfiltratoToolError(INFILTRATO_TOOL_ERROR_MESSAGES[error] ?? 'Non puoi agire ora');
    const onAccused = ({ accusedId }: PlayerAccusedPayload) => setMyAccusation(accusedId);
    const onSpeakerVoted = ({ defenderId }: PlayerSpeakerVotedPayload) => setSpeakerVote(defenderId);
    const onDuoSynced = ({ own, predict }: { own: VoteChoice; predict: VoteChoice }) => {
      setDuoOwn(own);
      setDuoPredict(predict);
      setDuoSynced(true);
    };
    const onDuoWavered = ({ rating }: { rating: 0 | 1 | 2 }) => setDuoRating(rating);
    const onHandRaised = ({ raised }: { raised: boolean }) => {
      setHandRaised(raised);
      setRaiseHandError(null);
    };
    const onRaiseHandError = ({ error }: { error: RaiseHandError }) =>
      setRaiseHandError(RAISE_HAND_ERROR_MESSAGES[error] ?? 'Non puoi alzare la mano ora');
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
    socket.on(SocketEvents.PlayerGroupMindSubmitted, onGroupMindSubmitted);
    socket.on(SocketEvents.PlayerGroupMindResult, onGroupMindResult);
    socket.on(SocketEvents.PlayerWriteSubmitted, onWriteSubmitted);
    socket.on(SocketEvents.PlayerWriteVoted, onWriteVoted);
    socket.on(SocketEvents.PlayerMyWriteToken, onMyWriteToken);
    socket.on(SocketEvents.PlayerInfiltratoRole, onInfiltratoRole);
    socket.on(SocketEvents.PlayerInfiltratoToolError, onInfiltratoToolError);
    socket.on(SocketEvents.PlayerAccused, onAccused);
    socket.on(SocketEvents.PlayerDilemmaSubmitted, onDilemmaSubmitted);
    socket.on(SocketEvents.PlayerSubmitDilemmaError, onSubmitDilemmaError);
    socket.on(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
    socket.on(SocketEvents.PlayerDuoSynced, onDuoSynced);
    socket.on(SocketEvents.PlayerDuoWavered, onDuoWavered);
    socket.on(SocketEvents.PlayerHandRaised, onHandRaised);
    socket.on(SocketEvents.PlayerRaiseHandError, onRaiseHandError);
    // On every (re)connect, if we hold a token, reclaim the same seat. Covers
    // socket-level reconnects (network blip) without a page reload.
    const onConnect = () => {
      const creds = credsRef.current;
      if (creds) {
        userInitiatedRef.current = false; // background reclaim — fail silently
        socket.emit(SocketEvents.PlayerJoin, creds);
      }
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
      userInitiatedRef.current = false; // background auto-rejoin — fail silently
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
      socket.off(SocketEvents.PlayerGroupMindSubmitted, onGroupMindSubmitted);
      socket.off(SocketEvents.PlayerGroupMindResult, onGroupMindResult);
      socket.off(SocketEvents.PlayerWriteSubmitted, onWriteSubmitted);
      socket.off(SocketEvents.PlayerWriteVoted, onWriteVoted);
      socket.off(SocketEvents.PlayerMyWriteToken, onMyWriteToken);
      socket.off(SocketEvents.PlayerInfiltratoRole, onInfiltratoRole);
      socket.off(SocketEvents.PlayerInfiltratoToolError, onInfiltratoToolError);
      socket.off(SocketEvents.PlayerAccused, onAccused);
      socket.off(SocketEvents.PlayerDilemmaSubmitted, onDilemmaSubmitted);
      socket.off(SocketEvents.PlayerSubmitDilemmaError, onSubmitDilemmaError);
      socket.off(SocketEvents.PlayerSpeakerVoted, onSpeakerVoted);
      socket.off(SocketEvents.PlayerDuoSynced, onDuoSynced);
      socket.off(SocketEvents.PlayerDuoWavered, onDuoWavered);
      socket.off(SocketEvents.PlayerHandRaised, onHandRaised);
      socket.off(SocketEvents.PlayerRaiseHandError, onRaiseHandError);
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
    setConfirmingLeave(false);
  };

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);
  // The last 5s of ANY phase timer buzz every phone once per second — mirrors
  // the host's audio timerWarn cue, which already ticks in the same window.
  useEffect(() => {
    if (remaining != null && remaining >= 1 && remaining <= 5) buzz(20);
  }, [remaining]);
  // Self-paced turn (DEFENSE/INTERVENTI): the floor countdown gates "Ho finito".
  const minRemaining = useCountdown(game?.defense?.minEndsAt ?? null);
  const canFinishNow = game?.defense?.minEndsAt == null || (minRemaining ?? 0) <= 0;
  // The speaker's elapsed time, counting UP from the turn start.
  const speakerElapsed = useElapsed(game?.defense?.startedAt ?? null);
  // The just-finished speaker's applause tally, shown briefly at the start of
  // the next turn (the server never clears it — the client treats it as a toast).
  const lastTurnApplause = useTransient(game?.lastTurnApplause ?? null, 3_000);
  // Self-paced turn (DUO_ARGUE): the floor countdown gates "Ho finito".
  const duoMinRemaining = useCountdown(game?.duoTurn?.minEndsAt ?? null);
  const duoCanFinishNow = game?.duoTurn?.minEndsAt == null || (duoMinRemaining ?? 0) <= 0;
  const duoSpeakerElapsed = useElapsed(game?.duoTurn?.startedAt ?? null);

  // Each new dilemma round starts with a clean (unselected) vote + prediction.
  // Keyed on the dilemma's id, not dilemmaIndex: a discarded/unanimous-skipped
  // dilemma is replaced IN PLACE (same index, fresh id) — indexing on
  // dilemmaIndex alone would miss that reset and leave a stale vote selected.
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
    setGroupMindAnswer(null);
    setGroupMindGuess(null);
    setGroupMindResult(null);
    setWriteText('');
    setWriteSubmitted(null);
    setWriteVotedForToken(null);
    setMyWriteToken(null);
    setInfiltratoToolError(null);
    setDuoOwn(null);
    setDuoPredict(null);
    setDuoSynced(false);
    setDuoRating(null);
  }, [game?.dilemma?.id]);

  // The twist's DUO_WAVER arrives mid-round (same dilemmaIndex): each entry into
  // the phase starts from a fresh, unselected rating.
  useEffect(() => {
    if (phase === 'DUO_WAVER') setDuoRating(null);
  }, [phase]);

  // 5.1 "Memoria del già-visto": remember every dilemma this device sees, so a
  // recurring group avoids déjà-vu even across separate (non-rematch) games.
  useEffect(() => {
    if (game?.dilemma?.id) addSeenDilemmaIds([game.dilemma.id]);
  }, [game?.dilemma?.id]);

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

  // Pre-fill the join nickname from the signed-in user's saved profile, but never
  // clobber a value they already have (typed, or restored from a saved session).
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetchWithTimeout('/api/me/profile', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const p = (await res.json()) as MyProfile;
        if (!cancelled && p.displayName) {
          setNickname((cur) => (cur.trim() === '' ? p.displayName ?? '' : cur));
        }
      } catch {
        /* best-effort prefill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  // Buzz the phone the moment it becomes this player's turn to speak (defense or
  // duel) so they look up from the screen — easy to miss on a shared TV.
  const turnSpeakerId =
    phase === 'DEFENSE' || phase === 'INTERVENTI'
      ? game?.defense?.speakerId ?? null
      : phase === 'DUO_ARGUE'
        ? game?.duoTurn?.speaker?.id ?? null
        : null;
  const myTurnToSpeak = turnSpeakerId != null && turnSpeakerId === playerId;
  useEffect(() => {
    if (myTurnToSpeak) buzz([60, 40, 60]);
  }, [myTurnToSpeak]);

  // A stale "raised" must never stick across turns/phases: the server clears the
  // raised-hand queue at the start of each defender turn, so mirror that locally.
  useEffect(() => {
    setHandRaised(false);
    setRaiseHandError(null);
  }, [turnSpeakerId, phase]);

  // A "confirming skip/discard" belongs to one phase only: a leftover armed state
  // must never carry into the next phase and fire an unintended tap-through.
  useEffect(() => {
    setConfirmingSkip(false);
    setConfirmingDiscard(false);
  }, [phase]);

  // The leader tossed the dilemma (room:dilemmaSkipped): brief toast on every
  // phone. The "discard" whoosh itself is owned by useSfxCues (it also needs
  // to suppress the natural transition sting when the re-reveal lands on a
  // different phase, e.g. discarding from an open VOTE_1).
  const toastTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const socket = getSocket();
    const onDilemmaSkipped = () => {
      setDilemmaSkippedToast(true);
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setDilemmaSkippedToast(false), 3_500);
    };
    socket.on(SocketEvents.RoomDilemmaSkipped, onDilemmaSkipped);
    return () => {
      socket.off(SocketEvents.RoomDilemmaSkipped, onDilemmaSkipped);
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // A confirmation belongs to one VOTE_2 round only: drop it whenever the phase
  // changes so the next second-vote starts from the "Confermo" affordance again.
  useEffect(() => {
    setConfirmed(false);
  }, [phase]);

  const castVote = (choice: VoteChoice) => {
    setVote(choice); // optimistic; reverts via player:voted/voteError
    setVoteError(null);
    setConfirmed(false); // changing the (second) vote un-confirms it
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

  // GROUP_MIND (4.1) submits both parts together in one call; each tap updates
  // its own local state and — once the OTHER part is already chosen — re-emits
  // the combined submission (so either tap order, and later changes, both work).
  const castGroupMindAnswer = (choice: VoteChoice) => {
    setGroupMindAnswer(choice); // optimistic; confirmed via player:groupMindSubmitted
    buzz(25);
    if (groupMindGuess) getSocket().emit(SocketEvents.PlayerGroupMind, { answer: choice, guess: groupMindGuess });
  };

  const castGroupMindGuess = (choice: VoteChoice) => {
    setGroupMindGuess(choice);
    buzz(25);
    if (groupMindAnswer) getSocket().emit(SocketEvents.PlayerGroupMind, { answer: groupMindAnswer, guess: choice });
  };

  const submitWrite = () => {
    const text = writeText.trim();
    if (!text) return;
    buzz(25);
    getSocket().emit(SocketEvents.PlayerWrite, { text });
  };

  const castWriteVote = (votedForToken: string) => {
    setWriteVotedForToken(votedForToken); // optimistic; confirmed via player:writeVoted
    buzz(25);
    getSocket().emit(SocketEvents.PlayerWriteVote, { votedForToken });
  };

  const castSpeakerVote = (defenderId: string) => {
    setSpeakerVote(defenderId); // optimistic; confirmed via player:speakerVoted
    buzz(25);
    getSocket().emit(SocketEvents.PlayerVoteSpeaker, { defenderId });
  };

  // DUO_PICK_PREDICT submits both parts together in one call (GROUP_MIND
  // pattern): each tap updates its own local state and — once the OTHER part is
  // already chosen — emits the combined submission, in either tap order.
  const castDuoOwn = (choice: VoteChoice) => {
    setDuoOwn(choice); // optimistic; confirmed via player:duoSynced
    buzz(25);
    if (duoPredict) getSocket().emit(SocketEvents.PlayerDuoSync, { own: choice, predict: duoPredict });
  };

  const castDuoPredict = (choice: VoteChoice) => {
    setDuoPredict(choice);
    buzz(25);
    if (duoOwn) getSocket().emit(SocketEvents.PlayerDuoSync, { own: duoOwn, predict: choice });
  };

  // DUO_WAVER: the secret "ti ha fatto vacillare?" rating (echoed back privately).
  const castDuoWaver = (rating: 0 | 1 | 2) => {
    setDuoRating(rating); // optimistic; confirmed via player:duoWavered
    buzz(25);
    getSocket().emit(SocketEvents.PlayerDuoWaver, { rating });
  };

  // With exactly one valid target (e.g. only 2 defenders total, so a defending
  // voter has just the other one left to pick from), auto-submit instead of
  // forcing a pointless tap on a list-of-one.
  useEffect(() => {
    if (phase !== 'SPEAKER_VOTE' || speakerVote != null) return;
    const candidates = (game?.speakerCandidates ?? []).filter((d) => d.id !== playerId);
    if (candidates.length === 1) castSpeakerVote(candidates[0].id);
  }, [phase, game?.speakerCandidates, playerId, speakerVote]);

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

  // "L'Infiltrato col merito" (4.5): seed a decoy spunto into the current
  // speaker's suggestions, once per round.
  const useInfiltratoTool = () => {
    buzz(25);
    getSocket().emit(SocketEvents.PlayerInfiltratoTool);
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
    userInitiatedRef.current = true;
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
    userInitiatedRef.current = true;
    getSocket().emit(SocketEvents.PlayerCreateRoom, { nickname: nick });
  };

  // This phone holds the leadership when the room's leaderId matches our seat.
  const isLeader = game?.leaderId != null && game.leaderId === playerId;

  // Offline human players the leader may manually remove (menu ⋮). Bots are
  // never flagged offline (no socket to lose), so this is humans-only already.
  const offlineHumans = players.filter((p) => !p.isBot && p.connected === false);

  // Musichetta + the Storie narrator voice play on the LEADER's phone ONLY, so a single
  // device carries them (no cacophony from 8 phones). The others stay silent for these
  // and just read the narration text. Unlocks on the leader's first tap (browser autoplay
  // policy); the AudioGate is an explicit fallback. Called unconditionally here (before
  // the render branches) so the audio survives across phase changes.
  const { audioReady, activateAudio } = useHostAudio({ enabled: isLeader, game });
  // Event stings (reveal/swing/win/awards/timerWarn/handRaise) play on EVERY phone once
  // joined (6.1, "energia collettiva") — the leader already gets them via useHostAudio
  // above, so this only adds sound for the non-leader phones. Unlocks silently on this
  // device's own first tap; no gate UI needed since players tap constantly to play.
  useSfxCues({ enabled: joinedCode != null && !isLeader, game });
  // Every joined phone gets a mute toggle: the leader's gates behind the explicit
  // AudioGate tap (musichetta/narrator need it), everyone else just gets the corner
  // button since their stings unlock silently on the first natural tap.
  const audioControls = isLeader ? (
    <>
      {!audioReady && <AudioGate onActivate={activateAudio} />}
      {audioReady && <MuteButton />}
    </>
  ) : joinedCode ? (
    <MuteButton />
  ) : null;

  // Leader controls (gated server-side; non-leader emits are ignored).
  const startGame = () => {
    setStartError(null);
    // Storia is a gruppo-only narrative; it carries only the chosen story id and
    // the server derives everything else from the authored tale.
    if (tipoPartita === 'storia') {
      if (!storyId) {
        setStartError('Scegli una storia');
        return;
      }
      getSocket().emit(SocketEvents.LeaderStartGame, {
        format: 'storia',
        storyId,
        mode: 'gruppo',
        serataLunga,
      });
      return;
    }
    // Percorso is a gruppo-only experience; it carries its own config (start tappa
    // + duration) and the server derives the dilemma count from the planned ascent.
    if (tipoPartita === 'percorso') {
      getSocket().emit(SocketEvents.LeaderStartGame, {
        format: 'percorso',
        startTappa,
        durata,
        mode: 'gruppo',
        infiltrato: infiltratoOn,
        squadre: squadreOn,
        serataLunga,
        caos,
      });
      return;
    }
    getSocket().emit(SocketEvents.LeaderStartGame, {
      dilemmaCount: FORMAT_DILEMMA_COUNT[format],
      register,
      mode: gameMode,
      infiltrato: gameMode === 'gruppo' && infiltratoOn,
      squadre: gameMode === 'gruppo' && squadreOn,
      mood,
      delicatoOptIn,
      serataLunga,
      caos,
      seenDilemmaIds: getSeenDilemmaIds(), // 5.1: avoid déjà-vu across separate games on this device
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
  const rematch = () => getSocket().emit(SocketEvents.LeaderRematch);
  const pauseGame = () => getSocket().emit(SocketEvents.LeaderPauseGame);
  const resumeGame = () => getSocket().emit(SocketEvents.LeaderResumeGame);
  const removePlayer = (id: string) => getSocket().emit(SocketEvents.LeaderRemovePlayer, { id });

  const submitDilemma = () => {
    buzz(15);
    getSocket().emit(SocketEvents.PlayerSubmitDilemma, {
      text: dilemmaText,
      optionA: dilemmaA,
      optionB: dilemmaB,
    });
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
  // the lobby except the terminal award/duel screens and the leader-paced cards:
  // the percorso recap + the four storia narrative beats get a "Continua ▶" inside
  // their own card instead of a bottom "Salta ▶").
  const phaseHasTimer = (p: GameStatePayload['phase']) =>
    p !== 'LOBBY' &&
    p !== 'FINAL_AWARDS' &&
    p !== 'DUO_PORTRAIT' &&
    p !== 'TAPPA_RECAP' &&
    p !== 'STORY_INTRO' &&
    p !== 'SCENE_INTRO' &&
    p !== 'SCENE_CONSEQUENCE' &&
    p !== 'STORY_EPILOGUE';

  // Phases where skipping cuts off OTHER players' still-secret input, so
  // "Salta ▶" needs a confirming 2nd tap instead of firing immediately.
  const isSecretVotePhase = (p: GameStatePayload['phase']) =>
    p === 'VOTE_1' ||
    p === 'VOTE_2' ||
    p === 'PREDICT' ||
    p === 'SPEAKER_VOTE' ||
    p === 'DUO_PICK_PREDICT' ||
    p === 'DUO_SIDE_PICK' ||
    p === 'DUO_PICK' ||
    p === 'DUO_REPICK' ||
    p === 'DUO_WAVER' ||
    p === 'GROUP_MIND' ||
    p === 'WRITE' ||
    p === 'WRITE_VOTE';

  // The leader's "skip the rest of this phase" button — only shown to the leader
  // during a phase that has a countdown. Rendered in each in-game branch.
  const skipButton =
    isLeader && phaseHasTimer(phase) ? (
      isSecretVotePhase(phase) ? (
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmingSkip) {
              setConfirmingSkip(false);
              advance();
            } else {
              setConfirmingSkip(true);
            }
          }}
        >
          {confirmingSkip ? 'Sicuro? Salta di nuovo ▶' : 'Salta ▶'}
        </Button>
      ) : (
        <Button variant="ghost" onClick={advance}>
          Salta ▶
        </Button>
      )
    ) : null;

  // The leader's "Scarta dilemma" (classic only): toss a dud dilemma while it can
  // still be tossed — DILEMMA_REVEAL or an open VOTE_1. One tap, but once someone
  // has already cast a secret vote it arms a confirming 2nd tap instead.
  const discard = () => {
    setConfirmingDiscard(false);
    buzz(25);
    getSocket().emit(SocketEvents.LeaderSkipDilemma);
  };
  const canDiscard =
    isLeader && game?.format === 'classic' && (phase === 'DILEMMA_REVEAL' || phase === 'VOTE_1');
  const discardButton = canDiscard ? (
    phase === 'VOTE_1' && (game?.votedCount ?? 0) > 0 ? (
      <Button
        variant="ghost"
        onClick={() => (confirmingDiscard ? discard() : setConfirmingDiscard(true))}
      >
        {confirmingDiscard ? "Sicuro? C'è già chi ha votato 🗑️" : '🗑️ Scarta dilemma'}
      </Button>
    ) : (
      <Button variant="ghost" onClick={discard}>
        🗑️ Scarta dilemma
      </Button>
    )
  ) : null;

  // Every in-game screen gets the discreet ⋮ exit (hidden, two-tap confirm). The
  // lobby keeps its own visible "Esci dalla stanza" link, so it's not wrapped here.
  // At PHASE_RESULTS (a round boundary) the leader also gets a one-tap "aggiungi
  // bot" here, to reintegrate a drop-out mid-game (3.5).
  const withLeaveMenu = (node: ReactNode) => (
    <>
      {node}
      {dilemmaSkippedToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + var(--space-3))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface, rgba(20, 30, 55, 0.95))',
            border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
            borderRadius: 'var(--radius-md, 12px)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: '0.95rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            zIndex: 30,
          }}
        >
          🗑️ Il capitano ha scartato il dilemma
        </div>
      )}
      {game?.paused && <PauseOverlay onResume={isLeader ? resumeGame : undefined} />}
      <LeaveGameMenu
        onLeave={leaveRoom}
        onAddBot={isLeader && phase === 'PHASE_RESULTS' ? addBot : undefined}
        onPause={
          isLeader && !game?.paused && phase !== 'LOBBY' && phase !== 'FINAL_AWARDS'
            ? pauseGame
            : undefined
        }
        offlinePlayers={isLeader ? offlineHumans : undefined}
        onRemovePlayer={isLeader ? removePlayer : undefined}
      />
    </>
  );

  // The Percorso in 2 screens read the partner's name from the 2-player roster.
  const partnerNickname = players.find((p) => p.id !== playerId)?.nickname ?? "l'altro";
  const iAmAdvocate = game?.duoAdvocateId != null && game.duoAdvocateId === playerId;

  // The devil's advocate has nothing to re-pick: their phone just waits for the
  // listener's verdict instead of showing vote controls.
  if (joinedCode && phase === 'DUO_REPICK' && iAmAdvocate) {
    return withLeaveMenu(
      <main style={wrap}>
        {audioControls}
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Arringa consegnata 🎭</h1>
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        <p style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>
          Hai difeso il lato che non era tuo, da vero avvocato del diavolo.
        </p>
        <p style={{ opacity: 0.75, margin: 0 }}>Ora {partnerNickname} decide se l'hai ribaltato…</p>
        {skipButton}
      </main>
    );
  }

  if (
    joinedCode &&
    (phase === 'VOTE_1' ||
      phase === 'VOTE_2' ||
      phase === 'DUO_SIDE_PICK' ||
      phase === 'DUO_PICK' ||
      phase === 'DUO_REPICK')
  ) {
    return withLeaveMenu(
      <VoteView
        phase={phase}
        dilemma={game?.dilemma}
        remaining={remaining}
        vote={vote}
        voteError={voteError}
        onVote={castVote}
        onConfirm={() => {
          setConfirmed(true);
          getSocket().emit(SocketEvents.PlayerConfirmVote);
        }}
        confirmed={confirmed}
        votedCount={game?.votedCount ?? 0}
        confirmedCount={game?.confirmedCount ?? 0}
        playerCount={players.length}
        missingVoters={game?.missingVoters ?? null}
        skipButton={
          <>
            {discardButton}
            {skipButton}
          </>
        }
      />
    );
  }

  if (joinedCode && phase === 'DUO_PICK_PREDICT') {
    return withLeaveMenu(
      <>
        {audioControls}
        <PickPredictView
          dilemma={game?.dilemma}
          partnerNickname={partnerNickname}
          remaining={remaining}
          own={duoOwn}
          predict={duoPredict}
          synced={duoSynced}
          onOwn={castDuoOwn}
          onPredict={castDuoPredict}
          syncedCount={game?.duoSyncedCount ?? 0}
          skipButton={skipButton}
        />
      </>
    );
  }

  if (joinedCode && phase === 'DUO_WAVER') {
    return withLeaveMenu(
      <>
        {audioControls}
        <WaverView
          partnerNickname={partnerNickname}
          twist={game?.duoAdvocateId != null}
          isAdvocate={iAmAdvocate}
          remaining={remaining}
          rating={duoRating}
          onRate={castDuoWaver}
          waverCount={game?.duoWaverCount ?? 0}
          skipButton={skipButton}
        />
      </>
    );
  }

  if (joinedCode && phase === 'DUO_PORTRAIT') {
    return withLeaveMenu(
      <>
        {audioControls}
        <PortraitView portrait={game?.duoPortrait ?? null} isLeader={isLeader} onRematch={rematch} />
      </>
    );
  }

  if (joinedCode && (phase === 'DEFENSE' || phase === 'INTERVENTI')) {
    return withLeaveMenu(
      <DefenseView
        phase={phase}
        defense={game?.defense ?? null}
        dilemma={game?.dilemma}
        isDevilRound={game?.isDevilRound ?? false}
        isPubblico={players.find((p) => p.id === playerId)?.role === 'pubblico'}
        absurdConstraint={game?.absurdConstraint ?? null}
        twist={game?.twist ?? null}
        isInfiltrator={infiltratoRole != null}
        infiltratoToolUsed={game?.infiltratoToolUsed ?? false}
        infiltratoToolError={infiltratoToolError}
        onUseInfiltratoTool={useInfiltratoTool}
        playerId={playerId}
        handRaised={handRaised}
        raiseHandError={raiseHandError}
        canFinishNow={canFinishNow}
        minRemaining={minRemaining}
        remaining={remaining}
        speakerElapsed={speakerElapsed}
        lastTurnApplause={lastTurnApplause}
        onFinish={sendFinish}
        onToggleHand={toggleHand}
        onReact={sendReaction}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'DUO_ARGUE') {
    return withLeaveMenu(
      <>
        {audioControls}
        <DuoArgueView
          speaker={game?.duoTurn?.speaker}
          dilemma={game?.dilemma}
          playerId={playerId}
          remaining={remaining}
          canFinishNow={duoCanFinishNow}
          minRemaining={duoMinRemaining}
          speakerElapsed={duoSpeakerElapsed}
          onFinish={sendFinish}
          onReact={sendReaction}
          skipButton={skipButton}
        />
      </>
    );
  }

  if (joinedCode && phase === 'SPEAKER_VOTE') {
    const candidates = (game?.speakerCandidates ?? []).filter((d) => d.id !== playerId);
    return withLeaveMenu(
      <SpeakerVoteView
        candidates={candidates}
        remaining={remaining}
        speakerVote={speakerVote}
        onVote={castSpeakerVote}
        speakerVotedCount={game?.speakerVotedCount ?? 0}
        playerCount={players.length}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'PREDICT') {
    return withLeaveMenu(
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
        predictedCount={game?.predictedCount ?? 0}
        playerCount={players.length}
        missingPredictors={game?.missingPredictors ?? null}
        skipButton={skipButton}
        finalStakesRound={game?.finalStakesRound ?? false}
      />
    );
  }

  if (joinedCode && phase === 'GROUP_MIND') {
    return withLeaveMenu(
      <GroupMindView
        question={game?.groupMindQuestion ?? null}
        remaining={remaining}
        answer={groupMindAnswer}
        guess={groupMindGuess}
        onAnswer={castGroupMindAnswer}
        onGuess={castGroupMindGuess}
        progress={game?.groupMindProgress ?? null}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'WRITE') {
    return withLeaveMenu(
      <WriteView
        prompt={game?.writePrompt ?? null}
        remaining={remaining}
        text={writeText}
        submitted={writeSubmitted}
        onTextChange={setWriteText}
        onSubmit={submitWrite}
        progress={game?.writeProgress ?? null}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'WRITE_VOTE') {
    // Each entry's `id` is an opaque per-round token, not a real player id
    // (the roster is public, so a real id would de-anonymize the vote).
    // myWriteToken (privately sent) is the only way to recognize — and hide —
    // our own entry, so we can never vote for ourselves.
    const otherAnswers = (game?.writtenAnswers ?? []).filter((a) => a.id !== myWriteToken);
    return withLeaveMenu(
      <WriteVoteView
        prompt={game?.writePrompt ?? null}
        remaining={remaining}
        answers={otherAnswers}
        votedForToken={writeVotedForToken}
        onVote={castWriteVote}
        progress={game?.writeVoteProgress ?? null}
        skipButton={skipButton}
      />
    );
  }

  if (joinedCode && phase === 'ACCUSE') {
    const candidates = players.filter((p) => p.id !== playerId);
    return withLeaveMenu(
      <AccuseView
        candidates={candidates}
        remaining={remaining}
        myAccusation={myAccusation}
        onAccuse={castAccuse}
      />
    );
  }

  if (joinedCode && phase !== 'LOBBY') {
    return withLeaveMenu(
      <>
        {audioControls}
        <StatusView
          phase={phase}
          game={game}
          remaining={remaining}
          playerId={playerId}
          isLeader={isLeader}
          players={players}
          onAdvance={advance}
          onRematch={rematch}
          infiltratoRole={infiltratoRole}
          predictionResult={predictionResult}
          swingBetResult={swingBetResult}
          knowResult={knowResult}
          groupMindResult={groupMindResult}
          blindSpot={blindSpot}
          skipButton={
            <>
              {discardButton}
              {skipButton}
            </>
          }
        />
      </>
    );
  }

  if (joinedCode) {
    return (
      <main style={wrap}>
        {audioControls}
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Sei nella stanza</h1>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '0.3rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {joinedCode}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
          <JoinQr code={joinedCode} />
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            Fai inquadrare il QR per entrare — oppure detta il codice
          </p>
          <ShareInviteButton code={joinedCode} />
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
            gap: 'var(--space-2)',
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
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: p.isBot ? 'var(--gold-soft)' : 'rgba(127,127,127,0.18)',
                  fontWeight: 600,
                  opacity: absent ? 0.5 : 1,
                }}
              >
                <span>{p.isBot ? '🤖 ' : ''}{p.nickname}</span>
                {p.isBot && p.persona && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{PERSONA_LABELS[p.persona]}</span>
                )}
                {p.role === 'pubblico' && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>🎟️ Pubblico</span>
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
            gap: 'var(--space-2)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Come funziona</h3>
          <ol style={{ margin: 0, padding: 0, listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {HOW_TO_PLAY.map((step) => (
              <li key={step} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{step}</li>
            ))}
          </ol>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 700 }}>
            🎯 {OBJECTIVE}
          </p>
        </Card>

        <SubmitDilemmaCard
          submittedCount={game?.submittedCount ?? 0}
          mySubmitted={mySubmitted}
          text={dilemmaText}
          optionA={dilemmaA}
          optionB={dilemmaB}
          onTextChange={setDilemmaText}
          onOptionAChange={setDilemmaA}
          onOptionBChange={setDilemmaB}
          onSubmit={submitDilemma}
          error={submitDilemmaError}
        />

        {isLeader ? (
          <LeaderSetup
            tipoPartita={tipoPartita}
            setTipoPartita={setTipoPartita}
            gameMode={gameMode}
            setGameMode={setGameMode}
            register={register}
            setRegister={setRegister}
            mood={mood}
            setMood={setMood}
            caos={caos}
            setCaos={setCaos}
            delicatoOptIn={delicatoOptIn}
            setDelicatoOptIn={setDelicatoOptIn}
            serataLunga={serataLunga}
            setSerataLunga={setSerataLunga}
            format={format}
            setFormat={setFormat}
            startTappa={startTappa}
            setStartTappa={setStartTappa}
            durata={durata}
            setDurata={setDurata}
            storyId={storyId}
            setStoryId={setStoryId}
            storieCatalog={game?.storieCatalog ?? []}
            submittedCount={game?.submittedCount ?? 0}
            infiltratoOn={infiltratoOn}
            setInfiltratoOn={setInfiltratoOn}
            squadreOn={squadreOn}
            setSquadreOn={setSquadreOn}
            tappaCounts={game?.tappaCounts}
            humanCount={humanCount}
            canAddBot={canAddBot}
            onAddBot={addBot}
            canStart={canStart}
            onStart={startGame}
            startError={startError}
          />
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>In attesa che il leader avvii la partita…</p>
        )}
        {confirmingLeave ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button
              type="button"
              onClick={leaveRoom}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--terracotta, inherit)',
                opacity: 0.9,
                fontSize: '0.85rem',
                fontWeight: 700,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Esci davvero
            </button>
            <button
              type="button"
              onClick={() => setConfirmingLeave(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                opacity: 0.55,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingLeave(true)}
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
        )}
      </main>
    );
  }

  const creating = mode === 'create';
  return (
    <main style={wrap}>
      {showScanner && (
        <Suspense fallback={null}>
          <QrScanner
            onScan={(scanned) => {
              setCode(scanned);
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}
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
          gap: 'var(--space-4)',
          width: 'min(90vw, 22rem)',
        }}
      >
        {!creating && (
          <Field label="Codice stanza">
            <TextInput
              mono
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              style={{ fontSize: '1.5rem' }}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowScanner(true)}
              style={{ marginTop: 'var(--space-2)', width: '100%' }}
            >
              📷 Scansiona QR
            </Button>
          </Field>
        )}
        <Field label="Nickname">
          <TextInput
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Il tuo nome"
            maxLength={20}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (creating ? 'Creo…' : 'Entro…') : creating ? 'Crea stanza' : 'Entra'}
        </Button>
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
