// Socket.IO event names + payload shapes shared by the host and player views.
// Keep these in sync with the server handlers in server/src/index.ts.

export const SocketEvents = {
  /** A player creates a room from their phone and becomes its leader. */
  PlayerCreateRoom: 'player:createRoom',
  /** A spectator screen (TV) attaches to an existing room, read-only. */
  SpectatorJoin: 'spectator:join',
  /** Player asks to join a room with a code + nickname. */
  PlayerJoin: 'player:join',
  /** Server confirms the join to the joining player. */
  PlayerJoined: 'player:joined',
  /** Server rejects the join (bad code, full room, missing nickname). */
  PlayerJoinError: 'player:joinError',
  /** Server broadcasts the current lobby roster to everyone in the room. */
  LobbyUpdate: 'lobby:update',
  /** Leader starts the game, choosing how many dilemmas to play. */
  LeaderStartGame: 'leader:startGame',
  /** Server rejects the start (not enough players, bad count, already started). */
  LeaderStartError: 'leader:startError',
  /** Leader force-advances the state machine, skipping the current countdown. */
  LeaderAdvancePhase: 'leader:advancePhase',
  /** Leader adds a server-driven bot to fill a seat. */
  LeaderAddBot: 'leader:addBot',
  /** Leader removes a bot by id. */
  LeaderRemoveBot: 'leader:removeBot',
  /** Server broadcasts the current game phase to everyone in the room. */
  GameState: 'game:state',
  /** Player casts (or changes) a secret A/B vote from their phone. */
  PlayerVote: 'player:vote',
  /** Player sends its Clerk session token so the server can attribute awards to the account. */
  PlayerIdentify: 'player:identify',
  /** Server confirms the player's current vote back to them only. */
  PlayerVoted: 'player:voted',
  /** Server rejects the vote (wrong phase, not in room, bad choice). */
  PlayerVoteError: 'player:voteError',
  /** Player explicitly confirms their (pre-filled) second vote (VOTE_2). */
  PlayerConfirmVote: 'player:confirmVote',
  /** Player taps a live audience reaction (DEFENSE / INTERVENTI / DUEL_ARGUE). */
  PlayerReact: 'player:react',
  /** Server re-broadcasts a single reaction emoji to everyone (the swarm on every screen). */
  RoomReaction: 'room:reaction',
  /** Player raises/lowers their hand during a defender's turn (DEFENSE). */
  PlayerRaiseHand: 'player:raiseHand',
  /** Server confirms the player's current raised-hand state back to them only. */
  PlayerHandRaised: 'player:handRaised',
  /** Current speaker (defender/intervenor) signals they are done (after the minimum). */
  PlayerFinishTurn: 'player:finishTurn',
  /** Server rejects the finish (too early / not the speaker / wrong phase). */
  PlayerFinishTurnError: 'player:finishTurnError',
  /** Player secretly predicts the post-defense majority (PREDICT phase). */
  PlayerPredict: 'player:predict',
  /** Server confirms the player's current prediction back to them only. */
  PlayerPredicted: 'player:predicted',
  /** Server rejects the prediction (wrong phase, not in room, bad choice). */
  PlayerPredictError: 'player:predictError',
  /** Server privately tells a predictor whether they were right (at PHASE_RESULTS). */
  PlayerPredictionResult: 'player:predictionResult',
  /** Player secretly bets whether the lead will change after the defenses (PREDICT phase). */
  PlayerSwingBet: 'player:swingBet',
  /** Server confirms the player's current swing bet back to them only. */
  PlayerSwingBetted: 'player:swingBetted',
  /** Server rejects the swing bet (wrong phase, not in room, bad value). */
  PlayerSwingBetError: 'player:swingBetError',
  /** Server privately tells a bettor whether they were right (at PHASE_RESULTS). */
  PlayerSwingBetResult: 'player:swingBetResult',
  /** Player writes their own dilemma in the LOBBY (max 2/player). */
  PlayerSubmitDilemma: 'player:submitDilemma',
  /** Server confirms the player's submission back to them only (with their count). */
  PlayerDilemmaSubmitted: 'player:dilemmaSubmitted',
  /** Server rejects the submission (wrong phase, empty/duplicate/too long, limit). */
  PlayerSubmitDilemmaError: 'player:submitDilemmaError',
  /** Player guesses how their assigned friend voted ("Quanto mi conosci" round). */
  PlayerKnowGuess: 'player:knowGuess',
  /** Server confirms the player's current guess back to them only. */
  PlayerKnowGuessed: 'player:knowGuessed',
  /** Server rejects the guess (not the know round, no target, bad value). */
  PlayerKnowGuessError: 'player:knowGuessError',
  /** Server privately tells a guesser whether they were right (at PHASE_RESULTS). */
  PlayerKnowGuessResult: 'player:knowGuessResult',
  /** Server privately tells a player they are the infiltrator (at game start). */
  PlayerInfiltratoRole: 'player:infiltratoRole',
  /** Player accuses who they think the infiltrator is (ACCUSE phase). */
  PlayerAccuse: 'player:accuse',
  /** Server confirms the player's current accusation back to them only. */
  PlayerAccused: 'player:accused',
  /** Server rejects the accusation (wrong phase, self, unknown target). */
  PlayerAccuseError: 'player:accuseError',
  /** Player secretly votes the most convincing defender (SPEAKER_VOTE phase). */
  PlayerVoteSpeaker: 'player:voteSpeaker',
  /** Server confirms the player's current best-speaker vote back to them only. */
  PlayerSpeakerVoted: 'player:speakerVoted',
  /** Server rejects the best-speaker vote (wrong phase, not in room, bad target). */
  PlayerSpeakerVoteError: 'player:speakerVoteError',
  /** Server sends each player their own private end-of-game blind-spot tip. */
  PlayerBlindSpot: 'player:blindSpot',
} as const;

/**
 * The fixed allowlist of live-reaction emojis (mirror of the server's `REACTIONS`).
 * Order is the order shown on the phone's reaction bar.
 */
export const REACTIONS = ['👏', '🔥', '🤯', '😂', '🤔'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Minimum gap between a player's reactions, client-side throttle (mirror of server). */
export const REACTION_MIN_INTERVAL_MS = 400;

/** Session formats and their dilemma counts (mirror server rooms.ts). */
export const SESSION_FORMATS = ['assaggio', 'classica', 'maratona'] as const;
export type SessionFormat = (typeof SESSION_FORMATS)[number];
export const FORMAT_DILEMMA_COUNT: Record<SessionFormat, number> = {
  assaggio: 3,
  classica: 5,
  maratona: 7,
};

/** Content registers (mirror server deck.ts / rooms.ts). */
export const CONTENT_REGISTERS = ['vita', 'business', 'misto'] as const;
export type ContentRegister = (typeof CONTENT_REGISTERS)[number];

/** Behaviour-based bot personalities (mirror of the server's `BotPersona`). */
export const BOT_PERSONAS = ['roccione', 'indeciso', 'gregge', 'bastian', 'equilibrato'] as const;
export type BotPersona = (typeof BOT_PERSONAS)[number];

/** Short host-facing labels for each bot persona (with an emoji). */
export const PERSONA_LABELS: Record<BotPersona, string> = {
  roccione: '🧊 Roccione',
  indeciso: '🤔 Indeciso',
  gregge: '🐑 Gregge',
  bastian: '😈 Bastian',
  equilibrato: '⚖️ Equilibrato',
};

/** Host-facing labels for the menu presets. */
export const FORMAT_LABELS: Record<SessionFormat, { nome: string; durata: string; round: number }> = {
  assaggio: { nome: 'Assaggio', durata: '~15 min', round: 3 },
  classica: { nome: 'Classica', durata: '~30 min', round: 5 },
  maratona: { nome: 'Maratona', durata: '~45 min', round: 7 },
};

export const REGISTER_LABELS: Record<ContentRegister, string> = {
  vita: 'Vita',
  business: 'Business pro',
  misto: 'Misto',
};

// ---------------------------------------------------------------------------
// "Percorso" mode — long themed ascent through life chapters (mirror server
// percorso.ts). Keep TAPPE / DURATA constants and the estimate in sync.
// ---------------------------------------------------------------------------

/** Number of tappe (life chapters) in a full percorso. */
export const N_TAPPE = 4;
export type Tappa = 1 | 2 | 3 | 4;

export interface TappaMeta {
  id: Tappa;
  key: 'basi' | 'bivi' | 'legami' | 'bilanci';
  nome: string;
  emoji: string;
  sottotitolo: string;
  descrizione: string;
}

/** The fixed climb (mirror of server TAPPE). */
export const TAPPE: readonly TappaMeta[] = [
  { id: 1, key: 'basi', nome: 'Le Basi', emoji: '🌱', sottotitolo: 'Giovinezza & prime scelte', descrizione: 'Scelte di partenza, leggere e quotidiane.' },
  { id: 2, key: 'bivi', nome: 'I Bivi', emoji: '🔀', sottotitolo: 'Carriera, soldi & relazioni', descrizione: 'I bivi che indirizzano la vita.' },
  { id: 3, key: 'legami', nome: 'I Legami', emoji: '🤝', sottotitolo: 'Famiglia & responsabilità', descrizione: 'Lealtà, sacrifici, io vs gli altri.' },
  { id: 4, key: 'bilanci', nome: 'I Bilanci', emoji: '🌅', sottotitolo: 'Eredità & senso', descrizione: 'I dilemmi più profondi ed esistenziali.' },
];

/** Look up a tappa's metadata (falls back to the first tappa). */
export function tappaMeta(id: number | null | undefined): TappaMeta {
  return TAPPE.find((t) => t.id === id) ?? TAPPE[0];
}

/** Duration presets (mirror server percorso.ts). */
export const DURATE = ['corto', 'medio', 'lungo'] as const;
export type Durata = (typeof DURATE)[number];
export const DURATA_BUDGET: Record<Durata, number> = { corto: 10, medio: 20, lungo: 30 };
export const DURATA_LABELS: Record<Durata, { nome: string; durata: string }> = {
  corto: { nome: 'Corto', durata: '~1h' },
  medio: { nome: 'Medio', durata: '~2h' },
  lungo: { nome: 'Lungo', durata: '~3h' },
};

/** Available dilemmas per tappa (server-provided in the lobby state). */
export type TappaCounts = Record<number, number>;

/** Per-tappa allocation of a duration's budget (mirror server allocateBudget). */
export function allocateBudget(startTappa: number, durata: Durata): Record<number, number> {
  const start = Math.min(N_TAPPE, Math.max(1, Math.floor(startTappa)));
  const budget = DURATA_BUDGET[durata];
  const range: number[] = [];
  for (let t = start; t <= N_TAPPE; t++) range.push(t);
  const count = range.length;
  const base = Math.floor(budget / count);
  const rem = budget % count;
  const alloc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  range.forEach((t, i) => {
    alloc[t] = base + (i >= count - rem ? 1 : 0);
  });
  return alloc;
}

/** Realistic (capped-by-availability) dilemma count for the host's live estimate. */
export function estimatePercorsoDilemmi(
  counts: TappaCounts | null | undefined,
  startTappa: number,
  durata: Durata,
): number {
  const alloc = allocateBudget(startTappa, durata);
  let total = 0;
  for (let t = 1; t <= N_TAPPE; t++) {
    const available = counts?.[t] ?? Number.MAX_SAFE_INTEGER;
    total += Math.min(alloc[t], available);
  }
  return total;
}

/** Minimum connected players required before the host can start. */
export const MIN_PLAYERS_TO_START = 3;

/** Game mode (mirror of the server's `GameMode`). */
export const GAME_MODES = ['gruppo', 'duello'] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** Host-facing labels for the game modes. */
export const MODE_LABELS: Record<GameMode, { nome: string; descr: string }> = {
  gruppo: { nome: 'Gruppo', descr: '3–8 giocatori' },
  duello: { nome: '1v1 Duello', descr: '2 giocatori' },
};

/** The game's objective, stated to players (persuasion framing). */
export const OBJECTIVE =
  'Convinci gli altri a passare dalla tua parte… e resta pronto a cambiare idea tu.';

/** Three-step "how to play", shown to players on their phone before the game. */
export const HOW_TO_PLAY: readonly string[] = [
  'Voti A o B sul tuo telefono.',
  'Ascolti chi difende la propria scelta.',
  'Voti di nuovo: confermi o cambi idea.',
];

/**
 * Phases of the game state machine. Mirror of the server's `GamePhase` in
 * server/src/game/rooms.ts — keep them in sync.
 */
export type GamePhase =
  | 'LOBBY'
  | 'PHASE_INTRO'
  | 'DILEMMA_REVEAL'
  | 'VOTE_1'
  | 'SPLIT_REVEAL'
  | 'PREDICT'
  | 'DEFENSE'
  | 'INTERVENTI'
  | 'VOTE_2'
  | 'SPEAKER_VOTE'
  | 'PHASE_RESULTS'
  // "Percorso" mode chapter framing (mirror server phases.ts).
  | 'TAPPA_INTRO'
  | 'TAPPA_RECAP'
  | 'ACCUSE'
  | 'FINAL_AWARDS'
  // 1v1 "Duello" mode phases (mirror server rooms.ts).
  | 'DUEL_PICK'
  | 'DUEL_REVEAL'
  | 'DUEL_ARGUE'
  | 'DUEL_REPICK'
  | 'DUEL_RESULT'
  | 'FINAL_DUEL';

export interface PlayerJoinPayload {
  code: string;
  nickname: string;
  /** Secret reconnect token from a previous session (localStorage); reclaims the seat. */
  token?: string;
}

/** Public, non-secret player info safe to show on host + all phones. */
export interface PublicPlayer {
  id: string;
  nickname: string;
  /** True for bot players (Fase B); absent/false for humans. */
  isBot?: boolean;
  /** The bot's persona; only present for bots. */
  persona?: BotPersona;
  /** Connection state: absent/true = present; false = temporarily away (grace period). */
  connected?: boolean;
}

export interface RemoveBotPayload {
  id: string;
}

export interface PlayerJoinedPayload {
  code: string;
  player: PublicPlayer;
  /** Secret token to persist (localStorage) for reconnecting to this seat. Sent only to this phone. */
  token: string;
}

export type JoinError = 'ROOM_NOT_FOUND' | 'NICKNAME_REQUIRED' | 'ROOM_FULL';

export interface PlayerJoinErrorPayload {
  error: JoinError;
}

export interface LobbyUpdatePayload {
  players: PublicPlayer[];
}

/** User-facing (Italian) messages for join errors. */
export const JOIN_ERROR_MESSAGES: Record<JoinError, string> = {
  ROOM_NOT_FOUND: 'Codice stanza non valido',
  NICKNAME_REQUIRED: 'Inserisci un nickname',
  ROOM_FULL: 'La stanza è piena (max 8 giocatori)',
};

export interface StartGamePayload {
  /** Session format: 'classic' (3/5/7, default) or 'percorso' (themed ascent). */
  format?: 'classic' | 'percorso';
  /** Classic: number of dilemmas. Ignored (and may be omitted) in percorso. */
  dilemmaCount?: number;
  /** Classic: content register. Ignored (and may be omitted) in percorso. */
  register?: ContentRegister;
  /** Percorso: tappa to start the ascent from (1..4). */
  startTappa?: number;
  /** Percorso: duration preset. */
  durata?: Durata;
  /** Game mode; defaults to 'gruppo' server-side when omitted (always gruppo in percorso). */
  mode?: GameMode;
  /** Enable "L'Infiltrato" (gruppo + ≥4 humans); defaults off. */
  infiltrato?: boolean;
  /** Enable "Squadre" (gruppo + ≥4 players); defaults off. */
  squadre?: boolean;
}

/** Minimum humans required to enable "L'Infiltrato" (mirror of server). */
export const MIN_INFILTRATO_HUMANS = 4;
/** Minimum players required to enable "Squadre" (mirror of server). */
export const MIN_SQUADRE_PLAYERS = 4;

/** "Squadre" team colour (mirror of server). */
export type Team = 'blu' | 'arancio';

/** Public team assignments + running scores (mirror of server `TeamState`). */
export interface TeamState {
  assignments: Array<{ playerId: string; nickname: string; team: Team }>;
  scores: { blu: number; arancio: number };
}

/** Public reveal of the infiltrator outcome at FINAL_AWARDS (mirror of server). */
export interface InfiltratoResult {
  infiltratorId: string;
  infiltratorNickname: string;
  flips: number;
  caught: boolean;
  won: boolean;
  votesAgainst: number;
}

/** Public dilemma shown on the shared screen: the prompt + its two options. */
export interface PublicDilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
}

/** Aggregate A vs B vote counts. No identities — counts only. */
export interface VoteSplit {
  A: number;
  B: number;
}

/**
 * A player defending a side in DEFENSE. Their identity + side are public during
 * the defense (inherent to speaking aloud) — no other votes are revealed.
 */
export interface Defender {
  id: string;
  nickname: string;
  side: VoteChoice;
  /**
   * True in the surprise "Avvocato del Diavolo" round: this defender argues
   * AGAINST their own vote. `side` is the side they ARGUE; their real vote is the
   * opposite. Absent/false in normal rounds.
   */
  devil?: boolean;
}

/**
 * Public defense/interventi view: who is speaking + turn/queue state. Mirror of the
 * server's `DefenseState` in server/src/game/rooms.ts — keep them in sync.
 */
export interface DefenseState {
  /** 'defense' = a chosen defender is speaking; 'intervento' = a queued mini-turn. */
  kind: 'defense' | 'intervento';
  /** The defender currently speaking (only in 'defense'); null in 'intervento'/no defenders. */
  speaker: Defender | null;
  /** The current intervenor (only in 'intervento'); null in 'defense'. */
  intervenor: { id: string; nickname: string } | null;
  /** Id of whoever is talking now (defender or intervenor), so the phone can match "your turn". */
  speakerId: string | null;
  /** 1-based index of the current turn (defense turn, or intervenor position). */
  turn: number;
  /** Total turns: defenders this round, or queued intervenors during INTERVENTI. */
  totalTurns: number;
  /** The bot defender's canned argument (Fase B); null for humans / interventi. */
  argument: string | null;
  /** Talking points for the defender's side; null in interventi / no speaker. */
  spunti: string[] | null;
  /** Live count of raised hands during the current defender's turn (0 in INTERVENTI). */
  raisedCount: number;
  /** Ordered intervenor names — only from INTERVENTI on; null during DEFENSE. */
  queue: { id: string; nickname: string }[] | null;
  /** When the current turn's minimum elapses (epoch ms); null for bot/absent speakers. */
  minEndsAt: number | null;
  /** Whether the current speaker may end now (minimum elapsed). */
  canFinish: boolean;
}

/**
 * The swing between the two votes (aggregate counts only). Mirror of the
 * server's `SwingResult` in server/src/game/rooms.ts.
 */
export interface SwingResult {
  first: VoteSplit;
  second: VoteSplit;
  switched: number;
  netSwing: VoteSplit;
}

/** How many votes a defender's side gained between the first and second vote. */
export interface DefenseImpact {
  defender: Defender;
  votes: number;
}

/** Public results view (PHASE_RESULTS): the swing + per-defender attribution. */
export interface PublicSwing extends SwingResult {
  attribution: DefenseImpact[];
}

/** The fun end-of-game superlatives (mirror of the server's `AwardId`). */
export type AwardId =
  | 'persuasore'
  | 'banderuola'
  | 'roccione'
  | 'sintonia'
  | 'bastian'
  | 'beniamino'
  | 'oracolo'
  | 'oratore'
  | 'voltagabbana'
  | 'sensitivo'
  | 'autore'
  | 'telepate';

/** Payload of the `room:reaction` broadcast: a single allowlisted emoji. */
export interface RoomReactionPayload {
  emoji: Reaction;
}

/** An award and who won it. */
export interface Award {
  id: AwardId;
  title: string;
  emoji: string;
  description: string;
  winner: PublicPlayer;
}

/** Duel reveal (DUEL_REVEAL): both players' picks + whether they agreed. */
export interface DuelReveal {
  picks: Array<{ id: string; nickname: string; choice: VoteChoice }>;
  agreed: boolean;
}

/** Duel argue turn (DUEL_ARGUE): who is arguing now + turn progress. */
export interface DuelTurn {
  speaker: { id: string; nickname: string; side: VoteChoice } | null;
  turn: number;
  totalTurns: number;
}

/** Duel round result (DUEL_RESULT): agreement, or who convinced whom. */
export interface DuelResult {
  agreed: boolean;
  convinced: Array<{
    persuader: { id: string; nickname: string };
    convinced: { id: string; nickname: string };
  }>;
}

/** Duel end summary (FINAL_DUEL): per-player persuasions + agreements count. */
export interface DuelSummary {
  scores: Array<{ id: string; nickname: string; persuasions: number }>;
  agreements: number;
}

/** Per-tappa progress within a percorso (mirror server PercorsoTappaProgress). */
export interface PercorsoTappaProgress {
  id: number;
  total: number;
  done: number;
}

/** Secret-safe percorso view (mirror server PercorsoView); null in classic. */
export interface PercorsoView {
  startTappa: number;
  durata: Durata;
  currentTappa: number | null;
  totalDilemmas: number;
  dilemmaIndex: number;
  tappe: PercorsoTappaProgress[];
  tappaDilemmas: number;
  tappaSwings: number;
}

export interface GameStatePayload {
  phase: GamePhase;
  dilemmaCount: number | null;
  /** Content register chosen at start; null in the lobby (and always null in percorso). */
  register: ContentRegister | null;
  /** Session format of the room. */
  format: 'classic' | 'percorso';
  /** Percorso view (progress + tappe), or null in classic / before start. */
  percorso: PercorsoView | null;
  /** Available dilemmas per tappa — static setup data for the percorso estimate. */
  tappaCounts: TappaCounts;
  /** Which dilemma (1-based) is in play; 0 before the first reveal. */
  dilemmaIndex: number;
  /** Epoch ms when the phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** The dilemma in play this round; null outside a dilemma round. */
  dilemma: PublicDilemma | null;
  /**
   * How many players have voted this round. Aggregate count only — never who
   * voted what (votes are secret). The A/B split is revealed later (SPLIT_REVEAL).
   */
  votedCount: number;
  /** How many players have confirmed their second vote (VOTE_2). Aggregate only. */
  confirmedCount: number;
  /**
   * How many players have made a secret prediction this round (PREDICT phase).
   * Aggregate count only — never who predicted what.
   */
  predictedCount: number;
  /**
   * How many players have placed a secret swing bet this round (PREDICT phase).
   * Aggregate count only — never who bet what.
   */
  swingBetCount: number;
  /** How many player-written dilemmas the group has added in the lobby. Count only. */
  submittedCount: number;
  /** "Quanto mi conosci" round: the public guesser→target ring; null otherwise. */
  knowPairs: KnowPair[] | null;
  /** How many players have guessed in the know round. Aggregate count only. */
  knowGuessedCount: number;
  /** "L'Infiltrato": how many have accused this game (ACCUSE). Aggregate count only. */
  accusedCount: number;
  /** "L'Infiltrato": the reveal at FINAL_AWARDS (who, won/caught); null otherwise. */
  infiltratoResult: InfiltratoResult | null;
  /** "Squadre": team assignments + running scores; null when teams are off. */
  teams: TeamState | null;
  /**
   * The defenders to vote between, shown only in SPEAKER_VOTE; null otherwise.
   * Their identities/side are already public (they spoke in DEFENSE).
   */
  speakerCandidates: Defender[] | null;
  /** How many have cast a best-speaker vote this round (aggregate count only). */
  speakerVotedCount: number;
  /**
   * The aggregate A/B split, shown only in SPLIT_REVEAL; null otherwise (e.g.
   * during VOTE_1 so the live vote isn't spoiled). Counts only, no identities.
   */
  split: VoteSplit | null;
  /**
   * Who is speaking + turn progress, shown only in DEFENSE; null otherwise.
   * Only the chosen defenders' identities/side are public.
   */
  defense: DefenseState | null;
  /**
   * True in the surprise "Avvocato del Diavolo" round (defenders argue the side
   * they did NOT vote). Revealed only from DEFENSE on; false otherwise.
   */
  isDevilRound: boolean;
  /**
   * The swing + per-defender attribution, shown only in PHASE_RESULTS; null
   * otherwise. Aggregate counts only — never who voted what.
   */
  swing: PublicSwing | null;
  /** The end-of-game awards, shown only in FINAL_AWARDS; null otherwise. */
  awards: Award[] | null;
  /** Game mode of the room; 'gruppo' until/unless a duel is started. */
  mode: GameMode;
  /** The leader-player's id (drives the game); null until a leader exists. */
  leaderId: string | null;
  /** Duel: both picks + agreement, shown only in DUEL_REVEAL; null otherwise. */
  duelReveal: DuelReveal | null;
  /** Duel: current arguer + turn, shown only in DUEL_ARGUE; null otherwise. */
  duelTurn: DuelTurn | null;
  /** Duel: round outcome, shown only in DUEL_RESULT; null otherwise. */
  duelResult: DuelResult | null;
  /** Duel: end summary, shown only in FINAL_DUEL; null otherwise. */
  duelSummary: DuelSummary | null;
}

/** Which side a player secretly votes for. */
export type VoteChoice = 'A' | 'B';

export interface PlayerIdentifyPayload {
  /** Clerk session token; the server verifies it and tags the player with the userId. */
  token: string;
}

/** One saved award as returned by GET /api/me/awards. */
export interface MyAward {
  id: string;
  awardId: string;
  title: string;
  emoji: string;
  description: string;
  gameCode: string;
  gameMode: string;
  nickname: string;
  wonAt: string;
}

/** Aggregate per-user stats for the dashboard (GET /api/me/dashboard). */
export interface MyStats {
  gamesPlayed: number;
  totalPersuasion: number;
  bestPersuasion: number;
  awardsCount: number;
}

/** One finished-game record in the dashboard history. */
export interface MyGameRecord {
  id: string;
  gameCode: string;
  mode: string;
  nickname: string;
  persuasion: number;
  rounds: number;
  awardsCount: number;
  playedAt: string;
}

/** Payload of GET /api/me/dashboard: stats + recent games + a small awards preview. */
export interface MyDashboard {
  stats: MyStats;
  recentGames: MyGameRecord[];
  recentAwards: Pick<MyAward, 'id' | 'awardId' | 'title' | 'emoji' | 'description' | 'nickname' | 'wonAt'>[];
}

export interface PlayerVotePayload {
  choice: VoteChoice;
}

export interface PlayerVotedPayload {
  choice: VoteChoice;
}

export interface PlayerPredictPayload {
  choice: VoteChoice;
}

export interface PlayerPredictedPayload {
  choice: VoteChoice;
}

/** Private per-predictor outcome at PHASE_RESULTS (mirror of the server's `PredictionResult`). */
export interface PlayerPredictionResultPayload {
  predicted: VoteChoice;
  /** The post-defense (second-vote) majority side, or null on a tie. */
  actual: VoteChoice | null;
  correct: boolean;
}

export type PredictError = 'ROOM_NOT_FOUND' | 'NOT_PREDICT_PHASE' | 'NOT_IN_ROOM' | 'INVALID_CHOICE';

export interface PlayerPredictErrorPayload {
  error: PredictError;
}

/** A secret bet on whether the leading side will change after the defenses. */
export type SwingBet = 'ribalta' | 'regge';

export interface PlayerSwingBetPayload {
  bet: SwingBet;
}

export interface PlayerSwingBettedPayload {
  bet: SwingBet;
}

/** Private per-bettor swing outcome at PHASE_RESULTS (mirror of `SwingBetOutcome`). */
export interface PlayerSwingBetResultPayload {
  bet: SwingBet;
  /** Whether the leading side actually changed (pre- vs post-defense). */
  flipped: boolean;
  correct: boolean;
}

export type SwingBetError = 'ROOM_NOT_FOUND' | 'NOT_PREDICT_PHASE' | 'NOT_IN_ROOM' | 'INVALID_BET';

export interface PlayerSwingBetErrorPayload {
  error: SwingBetError;
}

/** Max dilemmas a single player may write in the lobby (mirror of server). */
export const MAX_SUBMISSIONS_PER_PLAYER = 2;

export interface PlayerSubmitDilemmaPayload {
  text: string;
  optionA: string;
  optionB: string;
}

export interface PlayerDilemmaSubmittedPayload {
  /** How many dilemmas this player has written so far (1 or 2). */
  count: number;
}

export type SubmitDilemmaError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_LOBBY'
  | 'NOT_IN_ROOM'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'SAME_OPTIONS'
  | 'LIMIT_REACHED';

export interface PlayerSubmitDilemmaErrorPayload {
  error: SubmitDilemmaError;
}

/** User-facing (Italian) messages for dilemma-submission errors. */
export const SUBMIT_DILEMMA_ERROR_MESSAGES: Record<SubmitDilemmaError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_LOBBY: 'Si possono aggiungere dilemmi solo prima dell’inizio',
  NOT_IN_ROOM: 'Non sei in questa stanza',
  EMPTY: 'Scrivi la domanda e le due opzioni',
  TOO_LONG: 'Testo troppo lungo',
  SAME_OPTIONS: 'Le due opzioni devono essere diverse',
  LIMIT_REACHED: 'Hai già aggiunto il massimo dei dilemmi',
};

/** A guesser→target pair, shown publicly during the "Quanto mi conosci" round. */
export interface KnowPair {
  guesserId: string;
  guesserNickname: string;
  targetId: string;
  targetNickname: string;
}

export interface PlayerKnowGuessPayload {
  choice: VoteChoice;
}

export interface PlayerKnowGuessedPayload {
  choice: VoteChoice;
}

/** Private per-guesser outcome at PHASE_RESULTS of the know round. */
export interface PlayerKnowGuessResultPayload {
  targetId: string;
  guess: VoteChoice;
  /** The target's first vote, or null if unknown. */
  actual: VoteChoice | null;
  correct: boolean;
}

export type KnowGuessError = 'ROOM_NOT_FOUND' | 'NOT_KNOW_PHASE' | 'NO_TARGET' | 'INVALID_CHOICE';

export interface PlayerKnowGuessErrorPayload {
  error: KnowGuessError;
}

/** Private notice that this phone is the infiltrator (with the mission text). */
export interface PlayerInfiltratoRolePayload {
  mission: string;
}

export interface PlayerAccusePayload {
  accusedId: string;
}

export interface PlayerAccusedPayload {
  accusedId: string;
}

export type AccuseError = 'ROOM_NOT_FOUND' | 'NOT_ACCUSE_PHASE' | 'NOT_IN_ROOM' | 'INVALID_TARGET';

export interface PlayerAccuseErrorPayload {
  error: AccuseError;
}

export interface PlayerVoteSpeakerPayload {
  defenderId: string;
}

export interface PlayerSpeakerVotedPayload {
  defenderId: string;
}

export type SpeakerVoteError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_SPEAKER_VOTE_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_TARGET';

export interface PlayerSpeakerVoteErrorPayload {
  error: SpeakerVoteError;
}

export type VoteError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_VOTING_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_CHOICE';

export interface PlayerVoteErrorPayload {
  error: VoteError;
}

/** User-facing (Italian) messages for vote errors. */
export const VOTE_ERROR_MESSAGES: Record<VoteError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_VOTING_PHASE: 'Non è il momento di votare',
  NOT_IN_ROOM: 'Non sei in questa stanza',
  INVALID_CHOICE: 'Scelta non valida',
};

/** User-facing (Italian) short label for each phase, shown on the host. */
export const PHASE_LABELS: Record<GamePhase, string> = {
  LOBBY: 'In attesa',
  PHASE_INTRO: 'Si comincia',
  DILEMMA_REVEAL: 'Il dilemma',
  VOTE_1: 'Primo voto',
  SPLIT_REVEAL: 'Come si è diviso il gruppo',
  PREDICT: 'Pronostico',
  DEFENSE: 'Le difese',
  INTERVENTI: 'Interventi',
  VOTE_2: 'Secondo voto',
  SPEAKER_VOTE: 'Miglior oratore',
  PHASE_RESULTS: 'Risultati',
  TAPPA_INTRO: 'Nuova tappa',
  TAPPA_RECAP: 'Fine tappa',
  ACCUSE: "Chi era l'infiltrato?",
  FINAL_AWARDS: 'Premi finali',
  DUEL_PICK: 'Scegliete',
  DUEL_REVEAL: 'Rivelazione',
  DUEL_ARGUE: 'Duello',
  DUEL_REPICK: 'Si ri-sceglie',
  DUEL_RESULT: 'Esito',
  FINAL_DUEL: 'Risultato finale',
};

export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_HUMAN_PLAYERS'
  | 'WRONG_PLAYER_COUNT'
  | 'INVALID_DILEMMA_COUNT'
  | 'INVALID_REGISTER'
  | 'INFILTRATO_NEEDS_PLAYERS'
  | 'SQUADRE_NEEDS_PLAYERS'
  | 'ALREADY_STARTED';

export interface HostStartErrorPayload {
  error: StartGameError;
}

/** User-facing (Italian) messages for start-game errors. */
export const START_ERROR_MESSAGES: Record<StartGameError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_ENOUGH_PLAYERS: 'Servono almeno 3 partecipanti (anche bot)',
  NO_HUMAN_PLAYERS: 'Serve almeno una persona in carne e ossa',
  WRONG_PLAYER_COUNT: 'Il 1v1 richiede esattamente 2 giocatori',
  INVALID_DILEMMA_COUNT: 'Numero di dilemmi non valido',
  INVALID_REGISTER: 'Registro non valido',
  INFILTRATO_NEEDS_PLAYERS: "L'Infiltrato richiede almeno 4 persone",
  SQUADRE_NEEDS_PLAYERS: 'Le Squadre richiedono almeno 4 giocatori',
  ALREADY_STARTED: 'La partita è già iniziata',
};

export type BlindSpotId =
  | 'volubile' | 'rigido' | 'conformista' | 'contrarian' | 'difese-deboli' | 'equilibrato' | 'esordiente';

/** Private per-player improvement tip, shown only on that player's own phone. */
export interface BlindSpot {
  id: BlindSpotId;
  title: string;
  advice: string;
}
