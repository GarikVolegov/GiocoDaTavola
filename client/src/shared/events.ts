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
  /** Leader discards the current dilemma (DILEMMA_REVEAL / open VOTE_1): a fresh
   * card replays the same round. Classic format only. */
  LeaderSkipDilemma: 'leader:skipDilemma',
  /** Server tells everyone the leader discarded the dilemma (toast + sting). */
  RoomDilemmaSkipped: 'room:dilemmaSkipped',
  /** Leader returns a finished room to LOBBY for a rematch (same roster/code). */
  LeaderRematch: 'leader:rematch',
  /** Leader adds a server-driven bot to fill a seat. */
  LeaderAddBot: 'leader:addBot',
  /** Leader removes a bot by id. */
  LeaderRemoveBot: 'leader:removeBot',
  /** Leader frees an OFFLINE human player's seat (manual override, before
   * the automatic grace period elapses). No-op if the target is online. */
  LeaderRemovePlayer: 'leader:removePlayer',
  /** Leader pauses the game: freezes the countdown indefinitely, nothing
   * advances until leader:resumeGame. */
  LeaderPauseGame: 'leader:pauseGame',
  /** Leader resumes a paused game, restoring the frozen countdown. */
  LeaderResumeGame: 'leader:resumeGame',
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
  /** Player taps a live audience reaction (DEFENSE / INTERVENTI / DUO_ARGUE). */
  PlayerReact: 'player:react',
  /** Percorso in 2 (Atto I): own secret pick + prediction of the partner's, in one move. */
  PlayerDuoSync: 'player:duoSync',
  /** Server confirms the player's own pick+prediction back to them only. */
  PlayerDuoSynced: 'player:duoSynced',
  /** Server rejects the duo sync (wrong phase, not a player, bad choice). */
  PlayerDuoSyncError: 'player:duoSyncError',
  /** Percorso in 2: the listener secretly rates the arringa ("ti ha fatto vacillare?"). */
  PlayerDuoWaver: 'player:duoWaver',
  /** Server confirms the player's rating back to them only. */
  PlayerDuoWavered: 'player:duoWavered',
  /** Server rejects the rating (wrong phase, you are the advocate, out of range). */
  PlayerDuoWaverError: 'player:duoWaverError',
  /** Server re-broadcasts a single reaction emoji to everyone (the swarm on every screen). */
  RoomReaction: 'room:reaction',
  /** Player raises/lowers their hand during a defender's turn (DEFENSE). */
  PlayerRaiseHand: 'player:raiseHand',
  /** Server confirms the player's current raised-hand state back to them only. */
  PlayerHandRaised: 'player:handRaised',
  /** Server rejects the hand-raise (wrong phase, not in room, you're the speaker, queue full). */
  PlayerRaiseHandError: 'player:raiseHandError',
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
  /** Player answers + predicts the group's majority in one go (GROUP_MIND, 4.1). */
  PlayerGroupMind: 'player:groupMind',
  /** Server confirms the player's own answer + guess back to them only. */
  PlayerGroupMindSubmitted: 'player:groupMindSubmitted',
  /** Server rejects the submission (wrong phase, not in room, bad choice). */
  PlayerGroupMindError: 'player:groupMindError',
  /** Server privately tells a player whether their majority guess was right (at GROUP_MIND_REVEAL). */
  PlayerGroupMindResult: 'player:groupMindResult',
  /** Player submits their own written answer to the round's prompt (WRITE, 4.2). */
  PlayerWrite: 'player:write',
  /** Server confirms the player's current answer back to them only. */
  PlayerWriteSubmitted: 'player:writeSubmitted',
  /** Server rejects the answer (wrong phase, not in room, empty/too long). */
  PlayerWriteError: 'player:writeError',
  /** Player votes for their favorite OTHER written answer (WRITE_VOTE, 4.2). */
  PlayerWriteVote: 'player:writeVote',
  /** Server confirms the player's current vote back to them only. */
  PlayerWriteVoted: 'player:writeVoted',
  /** Server rejects the vote (wrong phase, not in room, self-vote, unknown target). */
  PlayerWriteVoteError: 'player:writeVoteError',
  /** Server privately tells this player their own answer's opaque token on
   * entering WRITE_VOTE (or reconnecting into it), so the client can filter
   * its own entry out of the anonymized list. */
  PlayerMyWriteToken: 'player:myWriteToken',
  /** Player submits a 1-10 score on the Termometro (Hot Take) slider. */
  PlayerHotTake: 'player:hotTake',
  /** Server confirms the player's 1-10 score back to them only. */
  PlayerHotTakeSubmitted: 'player:hotTakeSubmitted',
  /** Server rejects the score (wrong phase, not in room, out of 1-10 range). */
  PlayerHotTakeError: 'player:hotTakeError',
  /** Cruciverba Show: active player submits a word guess. */
  PlayerCruciverbaAttempt: 'player:cruciverbaAttempt',
  /** Server confirms/rejects the Cruciverba word guess back to the submitter. */
  PlayerCruciverbaFeedback: 'player:cruciverbaFeedback',
  /** Cruciverba Show: active player unlocks 1 letter and passes turn. */
  PlayerCruciverbaPass: 'player:cruciverbaPass',
  /** Tribunale degli Amici: active speaker finishes their 15s speech early. */
  PlayerTribunaleFinishTurn: 'player:tribunaleFinishTurn',
  /** Pre-debate reading grace window: leader or active speaker/defender starts the 15s timer immediately. */
  PlayerFinishReading: 'player:finishReading',
  /** Tribunale degli Amici: juror casts a vote for ACCUSA or DIFESA. */
  PlayerTribunaleVote: 'player:tribunaleVote',
  /** Server confirms the Tribunale vote back to the juror. */
  PlayerTribunaleVoted: 'player:tribunaleVoted',
  /** Server rejects an invalid Tribunale action. */
  PlayerTribunaleError: 'player:tribunaleError',
  /** Telepatia: player submits their silent 1-word answer. */
  PlayerTelepathy: 'player:telepathy',
  /** Server confirms the player's Telepatia word back to them only. */
  PlayerTelepathySubmitted: 'player:telepathySubmitted',
  /** Server rejects a Telepatia submission. */
  PlayerTelepathyError: 'player:telepathyError',
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
  /** The infiltrator seeds a decoy spunto into the current speaker's suggestions (4.5). */
  PlayerInfiltratoTool: 'player:infiltratoTool',
  /** Server rejects the tool use (not the infiltrator, wrong phase, already used, nobody speaking). */
  PlayerInfiltratoToolError: 'player:infiltratoToolError',
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
  /** Server sends each player their private prompt in L'INFILTRATO party mode. */
  PlayerSecretQuestion: 'player:secretQuestion',
  /** Player votes for a friend in ASSURDO MA SEMPLICE ("La Gogna") mode. */
  PlayerGognaVote: 'player:gognaVote',
  /** Server confirms the gogna vote back to the voter. */
  PlayerGognaVoted: 'player:gognaVoted',
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
export const CONTENT_REGISTERS = ['vita', 'business', 'carriera', 'misto'] as const;
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
  carriera: 'Carriera',
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
export function tappaMeta(id: number | null | undefined, percorsoId?: string | null): TappaMeta {
  const tappe = percorsoId ? getPercorsoMeta(percorsoId).tappe : TAPPE;
  return tappe.find((t) => t.id === id) ?? tappe[0];
}

export type CorsiaTono = 'risate' | 'direzione' | 'serio';

export const CORSIE_META: Record<CorsiaTono, { nome: string; emoji: string; sottotitolo: string }> = {
  risate: {
    nome: 'Serata tra Risate',
    emoji: '😂',
    sottotitolo: 'Leggero, assurdo e senza pensieri — vietati discorsi pesanti',
  },
  direzione: {
    nome: 'Direzione & Possibilità',
    emoji: '🧭',
    sottotitolo: 'Domande che aprono gli occhi su priorità, scelte e nuove strade',
  },
  serio: {
    nome: 'Discorsi Seri & Consapevolezza',
    emoji: '🔥',
    sottotitolo: 'Legami, verità scomode, senso della vita ed etica profonda',
  },
};

export const PERCORSO_IDS = [
  'risate-assurdi',
  'risate-quotidiano',
  'risate-amicizia-soldi',
  'bussola',
  'carriera-soldi',
  'rompere-schemi',
  'direzione-tempo-digitale',
  'direzione-coraggio-paure',
  'legami-verita',
  'bilanci-senso',
  'etica-estremi',
  'serio-famiglia-radici',
] as const;

export type PercorsoId = (typeof PERCORSO_IDS)[number];

export interface PercorsoMeta {
  id: PercorsoId;
  corsia: CorsiaTono;
  nome: string;
  emoji: string;
  sottotitolo: string;
  descrizione: string;
  tappe: readonly TappaMeta[];
}

export const PERCORSI_CATALOG: readonly PercorsoMeta[] = [
  {
    id: 'risate-assurdi',
    corsia: 'risate',
    nome: 'Assurdi & Scenari Folli',
    emoji: '🎭',
    sottotitolo: 'Zero pensieri · Ridere subito',
    descrizione: 'Domande surreali, paradossi quotidiani e scelte impossibili per scatenare risate senza impegno.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Riscaldamento', emoji: '🍕', sottotitolo: 'Gusti & manie', descrizione: 'Piccole follie quotidiane e abitudini inconfessabili.' },
      { id: 2, key: 'bivi', nome: 'Scenari Assurdi', emoji: '🛸', sottotitolo: 'E se succedesse…', descrizione: 'Situazioni paradossali dove ogni scelta è ridicola.' },
      { id: 3, key: 'legami', nome: 'Caos Sociale', emoji: '🍻', sottotitolo: 'Amici & figuracce', descrizione: 'Cosa faresti davanti a tutti pur di cavartela.' },
      { id: 4, key: 'bilanci', nome: 'Follia Finale', emoji: '🎪', sottotitolo: 'Senza freni', descrizione: 'Le domande più assurde per chiudere tra le risate.' },
    ],
  },
  {
    id: 'risate-quotidiano',
    corsia: 'risate',
    nome: 'Vita Quotidiana & Red Flag',
    emoji: '🚩',
    sottotitolo: 'Ex, serate & scomodità leggere',
    descrizione: 'Dibattiti accesi su abitudini, amicizie, appuntamenti e piccoli egoismi di ogni giorno.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Piccole Ipocrisie', emoji: '📱', sottotitolo: 'Quello che fanno tutti', descrizione: 'Chat, social, ritardi e bugie bianche.' },
      { id: 2, key: 'bivi', nome: 'Red Flag', emoji: '🚩', sottotitolo: 'Appuntamenti & ex', descrizione: 'Segnali d’allarme e scelte scomode ma divertenti.' },
      { id: 3, key: 'legami', nome: 'Segreti da Tavola', emoji: '🍷', sottotitolo: 'Complicità', descrizione: 'Quanto siamo davvero sinceri con gli amici?' },
      { id: 4, key: 'bilanci', nome: 'Verdetto Leggero', emoji: '😂', sottotitolo: 'Senza maschere', descrizione: 'Le confessioni più spassose della serata.' },
    ],
  },
  {
    id: 'risate-amicizia-soldi',
    corsia: 'risate',
    nome: 'Amici, Vacanze & Conti',
    emoji: '💸',
    sottotitolo: 'Conti alla romana, favori & case condivise',
    descrizione: 'Le micro-tensioni comiche e verissime quando si dividono spese, vacanze di gruppo, passaggi e regali.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Al Ristorante', emoji: '🍕', sottotitolo: 'Conti & mance', descrizione: 'Alla romana o ognuno il suo? L’inizio di ogni guerra fredda.' },
      { id: 2, key: 'bivi', nome: 'Vacanza di Gruppo', emoji: '🏖️', sottotitolo: 'Convivenza forzata', descrizione: 'Spesa comune, aria condizionata, orari e stanze migliori.' },
      { id: 3, key: 'legami', nome: 'Prestiti & Favori', emoji: '🤝', sottotitolo: '«Poi te li ridò»', descrizione: 'Passaggi in auto, regali collettivi e soldi mai tornati.' },
      { id: 4, key: 'bilanci', nome: 'Sopravvivere al Gruppo', emoji: '🍻', sottotitolo: 'Amicizia vs portafoglio', descrizione: 'Dove finisce la generosità e inizia il braccino corto.' },
    ],
  },
  {
    id: 'bussola',
    corsia: 'direzione',
    nome: 'Bussola di Vita',
    emoji: '🧭',
    sottotitolo: 'Priorità, coraggio & direzione',
    descrizione: 'Domande che aprono gli occhi su come stai usando il tuo tempo, cosa rimandi e dove stai andando.',
    tappe: TAPPE,
  },
  {
    id: 'carriera-soldi',
    corsia: 'direzione',
    nome: 'Ambizione, Carriera & Soldi',
    emoji: '🚀',
    sottotitolo: 'Libertà, rischio & compromessi',
    descrizione: 'Lavoro vs vita vera, sicurezza vs salto nel vuoto, etica del successo e prezzo dell’ambizione.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Punto di Partenza', emoji: '💼', sottotitolo: 'Talento & sicurezza', descrizione: 'Stipendio sicuro o strada tua? Le prime scelte.' },
      { id: 2, key: 'bivi', nome: 'Il Prezzo della Crescita', emoji: '📈', sottotitolo: 'Tempo vs denaro', descrizione: 'Quanto sei disposto a sacrificare per salire?' },
      { id: 3, key: 'legami', nome: 'Integrità & Potere', emoji: '🤝', sottotitolo: 'Etica al lavoro', descrizione: 'Scelte difficili tra risultati, colleghi e coscienza.' },
      { id: 4, key: 'bilanci', nome: 'Libertà Vera', emoji: '🦅', sottotitolo: 'Abbastanza o sempre di più?', descrizione: 'Cosa significa davvero aver vinto nel lavoro.' },
    ],
  },
  {
    id: 'rompere-schemi',
    corsia: 'direzione',
    nome: 'Rompere gli Schemi',
    emoji: '💡',
    sottotitolo: 'Nuove possibilità & punti ciechi',
    descrizione: 'Domande progettate per smontare il pilota automatico, riconoscere le paure invisibili e vedere alternative.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Lo Specchio', emoji: '🪞', sottotitolo: 'Abitudini automatiche', descrizione: 'Cosa fai per inerzia senza chiederti più il perché.' },
      { id: 2, key: 'bivi', nome: 'L’Attrito', emoji: '⚡', sottotitolo: 'Uscire dalla comfort zone', descrizione: 'Il costo nascosto del restare dove sei.' },
      { id: 3, key: 'legami', nome: 'Il Cambio di Rotta', emoji: '🔄', sottotitolo: 'Nuove lenti', descrizione: 'Guardare i tuoi problemi con gli occhi di un altro.' },
      { id: 4, key: 'bilanci', nome: 'Possibilità Aperte', emoji: '✨', sottotitolo: 'Da domani', descrizione: 'Una scelta concreta che cambia la tua traiettoria.' },
    ],
  },
  {
    id: 'direzione-tempo-digitale',
    corsia: 'direzione',
    nome: 'Tempo, Attenzione & Digitale',
    emoji: '📵',
    sottotitolo: 'Presenza reale vs pilota automatico',
    descrizione: 'Chi possiede davvero le tue ore? Notifiche, vetrina social, reperibilità continua e recupero della presenza.',
    tappe: [
      { id: 1, key: 'basi', nome: 'L’Attenzione Rubata', emoji: '📱', sottotitolo: 'Schermi & riflessi', descrizione: 'Quanto spesso prendi il telefono senza nemmeno volerlo.' },
      { id: 2, key: 'bivi', nome: 'Vetrina vs Realtà', emoji: '🪞', sottotitolo: 'Confronto continuo', descrizione: 'Vivere momenti veri o documentarli per chi guarda.' },
      { id: 3, key: 'legami', nome: 'Reperibilità & Confini', emoji: '🔕', sottotitolo: 'Sempre connessi', descrizione: 'Il diritto di sparire senza sentirsi in colpa.' },
      { id: 4, key: 'bilanci', nome: 'Riprendersi il Tempo', emoji: '⏳', sottotitolo: 'Scelte di presenza', descrizione: 'Tagliare il rumore per tornare padroni delle proprie giornate.' },
    ],
  },
  {
    id: 'direzione-coraggio-paure',
    corsia: 'direzione',
    nome: 'Coraggio, Rischio & Paure',
    emoji: '🦁',
    sottotitolo: 'Sbloccare ciò che rimandi da anni',
    descrizione: 'Il prezzo nascosto dell’immobilismo, la paura del giudizio altrui e il confine tra prudenza e resa.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Freno a Mano', emoji: '🛑', sottotitolo: 'Paure quotidiane', descrizione: 'Le scuse eleganti con cui rimandi ciò che conta.' },
      { id: 2, key: 'bivi', nome: 'Il Giudizio Altrui', emoji: '👀', sottotitolo: 'Sguardi & aspettative', descrizione: 'Quanto decidi per te e quanto per non deludere gli altri.' },
      { id: 3, key: 'legami', nome: 'Il Salto Calcolato', emoji: '🪂', sottotitolo: 'Errore vs rimpianto', descrizione: 'Meglio fallire provandoci o restare al sicuro a metà?' },
      { id: 4, key: 'bilanci', nome: 'Il Primo Passo', emoji: '🦁', sottotitolo: 'Azione concreta', descrizione: 'La decisione coraggiosa che cambia tutto il resto.' },
    ],
  },
  {
    id: 'legami-verita',
    corsia: 'serio',
    nome: 'Legami, Amore & Verità',
    emoji: '❤️',
    sottotitolo: 'Affetti, confini & sincerità',
    descrizione: 'Discorsi seri su amore, famiglia, lealtà, perdono e tutto ciò che spesso non ci si dice.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Presenza', emoji: '🫶', sottotitolo: 'Essere davvero lì', descrizione: 'Attenzione, ascolto e piccole verità nelle relazioni.' },
      { id: 2, key: 'bivi', nome: 'Confini', emoji: '🛡️', sottotitolo: 'Io vs noi', descrizione: 'Dove finisce l’amore e inizia il perdersi.' },
      { id: 3, key: 'legami', nome: 'Lealtà & Sacrificio', emoji: '🤝', sottotitolo: 'Scelte che pesano', descrizione: 'Famiglia, amicizie storiche e verità scomode.' },
      { id: 4, key: 'bilanci', nome: 'Perdono & Verità', emoji: '🕊️', sottotitolo: 'Cosa resta', descrizione: 'Ciò che vale la pena salvare, e ciò che va lasciato andare.' },
    ],
  },
  {
    id: 'bilanci-senso',
    corsia: 'serio',
    nome: 'Bilanci, Senso & Eredità',
    emoji: '🌅',
    sottotitolo: 'Identità, rimpianti & valore',
    descrizione: 'Le domande profonde che mettono in prospettiva tutta una vita: cosa conta quando togli il rumore.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Tempo', emoji: '⏳', sottotitolo: 'Come lo spendi', descrizione: 'La differenza tra essere occupati ed essere vivi.' },
      { id: 2, key: 'bivi', nome: 'L’Identità', emoji: '🧩', sottotitolo: 'Chi sei senza ruoli', descrizione: 'Cosa resta di te se togli lavoro, soldi e status.' },
      { id: 3, key: 'legami', nome: 'I Rimpianti', emoji: '🌊', sottotitolo: 'Cose non dette o non fatte', descrizione: 'Guardare in faccia ciò che ancora puoi cambiare.' },
      { id: 4, key: 'bilanci', nome: 'L’Eredità', emoji: '🌅', sottotitolo: 'Il segno che lasci', descrizione: 'Come vuoi essere ricordato da chi hai amato.' },
    ],
  },
  {
    id: 'etica-estremi',
    corsia: 'serio',
    nome: 'Etica, Potere & Scelte Estreme',
    emoji: '⚖️',
    sottotitolo: 'Dilemmi morali & coscienza',
    descrizione: 'Scenari limite dove non esiste una risposta facile: giustizia, responsabilità e principi non negoziabili.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Regole vs Coscienza', emoji: '📜', sottotitolo: 'Piccoli test morali', descrizione: 'Quando la legge e ciò che è giusto non coincidono.' },
      { id: 2, key: 'bivi', nome: 'Il Bene Maggiore', emoji: '⚖️', sottotitolo: 'Uno o molti', descrizione: 'Responsabilità verso gli sconosciuti vs chi ami.' },
      { id: 3, key: 'legami', nome: 'Potere & Verità', emoji: '🕯️', sottotitolo: 'Cosa faresti al comando', descrizione: 'Il peso delle decisioni irreversibili.' },
      { id: 4, key: 'bilanci', nome: 'Principi Ultimi', emoji: '🏛️', sottotitolo: 'La linea che non superi', descrizione: 'Scoprire fino a dove arrivano davvero i tuoi valori.' },
    ],
  },
  {
    id: 'serio-famiglia-radici',
    corsia: 'serio',
    nome: 'Famiglia, Radici & Aspettative',
    emoji: '🏡',
    sottotitolo: 'Eredità emotiva, confini & perdono',
    descrizione: 'Il rapporto con chi ti ha cresciuto: onorare le radici senza restarne prigionieri, verità taciute e cura.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Le Aspettative', emoji: '🎒', sottotitolo: 'Sogni ereditati', descrizione: 'Quando la strada scelta è davvero tua e quando è un debito verso casa.' },
      { id: 2, key: 'bivi', nome: 'La Distanza Giusta', emoji: '🚪', sottotitolo: 'Autonomia & sensi di colpa', descrizione: 'Mettere confini sani senza rompere il legame.' },
      { id: 3, key: 'legami', nome: 'Verità di Casa', emoji: '🕯️', sottotitolo: 'Non detti & ruoli', descrizione: 'Affrontare ciò che in famiglia si è sempre preferito tacere.' },
      { id: 4, key: 'bilanci', nome: 'Perdono & Cura', emoji: '🏡', sottotitolo: 'Pace con le origini', descrizione: 'Accettare i limiti di chi ti ha cresciuto e scegliere come ricambiare.' },
    ],
  },
];

export function getPercorsoMeta(id?: string | null): PercorsoMeta {
  return PERCORSI_CATALOG.find((p) => p.id === id) ?? PERCORSI_CATALOG.find((p) => p.id === 'bussola')!;
}

export type PercorsoCounts = Record<string, TappaCounts>;
export type CoppieIntensity = 'complicita' | 'piccante' | 'profondo';
export type InfiltratoTono = 'risate' | 'profondo' | 'misto';

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
export const MIN_PLAYERS_TO_START = 1;

/** Game mode (mirror of the server's `GameMode`). */
export const GAME_MODES = ['gruppo', 'duello'] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** The revamped viral party modes (including Serata Mix variable rotation). */
export const PARTY_MODES = [
  'flash',
  'infiltrato',
  'coppie',
  'assurdo',
  'preferiresti',
  'cruciverba',
  'tribunale',
  'classico',
  'mix',
] as const;
export type PartyMode = (typeof PARTY_MODES)[number];

export interface HotTakePromptPayload {
  id: string;
  text: string;
  lowLabel?: string;
  highLabel?: string;
}

export interface HotTakePlayerScorePayload {
  playerId: string;
  nickname: string;
  score: number;
}

export interface HotTakeRevealPayload {
  prompt: HotTakePromptPayload;
  average: number;
  scores: HotTakePlayerScorePayload[];
  lowest: HotTakePlayerScorePayload | null;
  highest: HotTakePlayerScorePayload | null;
  spread: number;
}

export interface CruciverbaWordPayload {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  length: number;
  clue: string;
  status: 'pending' | 'solved' | 'revealed';
  solvedByName: string | null;
  answer?: string;
}

export interface CruciverbaCellPayload {
  letter: string;
  wordNumbers: number[];
}

export interface CruciverbaStatePayload {
  boardId: string;
  theme: string;
  rows: number;
  cols: number;
  activePlayerId: string | null;
  activePlayerName: string | null;
  activeWordId: string;
  turnsTaken: number;
  maxTurns: number;
  words: CruciverbaWordPayload[];
  cells: Array<Array<CruciverbaCellPayload | null>>;
  lastEvent?: {
    playerName: string;
    kind: 'solved' | 'hint' | 'timeout' | 'wrong';
    wordId: string;
    wordText?: string;
    pointsAwarded: number;
  };
}

export interface TribunaleCasePayload {
  id: string;
  title: string;
  scenario: string;
  accusaRole: string;
  difesaRole: string;
  penalty: string;
}

export interface TribunaleStatePayload {
  caseData: TribunaleCasePayload;
  accusaId: string;
  accusaName: string;
  difesaId: string;
  difesaName: string;
  speakerIndex: 0 | 1;
  activeSpeakerId: string;
  activeSpeakerName: string;
  votesCount: number;
  totalJurors: number;
  missingJurorNames: string[];
  verdict?: {
    accusaVotes: number;
    difesaVotes: number;
    winner: 'ACCUSA' | 'DIFESA' | 'TIE';
    winnerNames: string[];
    loserName: string | null;
    pointsWinner: number;
    pointsTie: number;
  };
}

export interface TelepathyPromptPayload {
  id: string;
  prompt: string;
}

export interface TelepathyClusterPayload {
  word: string;
  nicknames: string[];
  playerIds: string[];
  pointsPerPlayer: number;
}

export interface TelepathyRevealPayload {
  prompt: TelepathyPromptPayload;
  clusters: TelepathyClusterPayload[];
  totalPlayers: number;
  syncedCount: number;
  biggestMatch: TelepathyClusterPayload | null;
}

export type PartyIntensity = 'complicita' | 'piccante';

export interface FlashResultPayload {
  isEmpty?: boolean;
  isUnanimous: boolean;
  isTie: boolean;
  minoritySide: VoteChoice | null;
  minorityNicknames: string[];
  majorityNicknames: string[];
  unvotedNicknames: string[];
}

export type PreferirestiChoice = 'A' | 'B' | 'C' | 'D';
export const PREFERIRESTI_CHOICES = ['A', 'B', 'C', 'D'] as const;

export interface PreferirestiOptionTally {
  letter: PreferirestiChoice;
  label: string;
  count: number;
  voterNicknames: string[];
}

export interface PreferirestiResultPayload {
  isEmpty?: boolean;
  isUnanimous: boolean;
  isTie: boolean;
  winningChoices: PreferirestiChoice[];
  minorityNicknames: string[];
  majorityNicknames: string[];
  unvotedNicknames: string[];
  options: PreferirestiOptionTally[];
}

export interface CoupleSummaryPayload {
  id: string;
  label: string;
  memberAId: string;
  memberBId: string;
  memberAName: string;
  memberBName: string;
  score: number;
  matches: number;
  mismatches: number;
}

export interface CoupleRoundOutcomePayload {
  coupleId: string;
  memberAId: string;
  memberBId: string;
  memberAName: string;
  memberBName: string;
  choiceA: VoteChoice | null;
  choiceB: VoteChoice | null;
  choiceALabel: string | null;
  choiceBLabel: string | null;
  kind: 'match' | 'mismatch' | 'challenge_done' | 'challenge_partial' | 'challenge_skip' | 'incomplete';
  pointsAwarded: number;
}

export interface InfiltratoRoundResult {
  round: number;
  infiltratorId: string;
  infiltratorNickname: string;
  groupQuestion: string;
  impostorQuestion: string;
  accusedId: string | null;
  accusedNickname: string | null;
  caught: boolean;
  infiltratorWon: boolean;
}

export interface PartyCardPayload {
  mode: PartyMode;
  cardType?: 'allineamento' | 'verita' | 'obbligo' | 'gogna' | 'dignita' | 'dilemma';
  intensity?: PartyIntensity;
  prompt: string;
  options?: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  penalty?: string;
  sentenza?: string;
  groupQuestion?: string;
  impostorQuestion?: string;
  category?: string;
  gognaTargetId?: string;
  gognaTargetNickname?: string;
  gognaVotes?: number;
  infiltratorUnmasked?: boolean;
  infiltratorNickname?: string;
  infiltratorId?: string;
  infiltratoRoundResult?: InfiltratoRoundResult | null;
  flashResult?: FlashResultPayload | null;
  preferirestiResult?: PreferirestiResultPayload | null;
  /** All active fixed couples + scoreboard in Coppie & Scintille mode. */
  couples?: CoupleSummaryPayload[] | null;
  /** Parallel round outcomes for each couple shown on SPLIT_REVEAL. */
  coupleRoundResults?: CoupleRoundOutcomePayload[] | null;
  affinityScore?: number | null;
}

export interface PlayerSecretQuestionPayload {
  question: string;
  isInfiltrator: boolean;
  round: number;
}

export interface PlayerGognaVotePayload {
  targetId: string;
}

/** Host-facing labels for the game modes. */
export const MODE_LABELS: Record<GameMode, { nome: string; descr: string }> = {
  gruppo: { nome: 'Gruppo', descr: '1–8 giocatori' },
  duello: { nome: 'Percorso in 2', descr: 'in coppia · 2 giocatori' },
};

/** The evening's mood (2.2, mirror of the server's deck.ts `Mood`). */
export const MOODS = ['leggera', 'mista', 'profonda'] as const;
export type Mood = (typeof MOODS)[number];

/** Setup-screen labels for each mood. */
export const MOOD_LABELS: Record<Mood, { nome: string; descr: string }> = {
  leggera: { nome: '😂 Leggera', descr: 'niente temi estremi' },
  mista: { nome: '🎭 Mista', descr: 'un po’ di tutto' },
  profonda: { nome: '🌊 Profonda', descr: 'si va a fondo' },
};

/** Group familiarity setting (mirror of server deck.ts `Familiarita`). */
export const FAMILIARITA_VALUES = ['vecchi_amici', 'nuove_conoscenze'] as const;
export type Familiarita = (typeof FAMILIARITA_VALUES)[number] | 'misto';

export const FAMILIARITA_LABELS: Record<'vecchi_amici' | 'nuove_conoscenze', { nome: string; descr: string }> = {
  vecchi_amici: {
    nome: '🫂 Vecchi amici',
    descr: 'Vi conoscete già: niente convenevoli, dinamiche vere e non detti',
  },
  nuove_conoscenze: {
    nome: '✨ Nuove conoscenze',
    descr: 'Gruppo nuovo o misto: rompete il ghiaccio senza imbarazzi',
  },
};

/** The leader's "caos" dial (4.3): how often a dilemma round draws a surprise
 * mechanical twist at DEFENSE. Mirror of the server's twists.ts `Caos`. */
export const CAOS_LEVELS = ['assente', 'basso', 'alto'] as const;
export type Caos = (typeof CAOS_LEVELS)[number];

/** Setup-screen labels for each caos level. */
export const CAOS_LABELS: Record<Caos, { nome: string; descr: string }> = {
  assente: { nome: '😌 Assente', descr: 'partita classica' },
  basso: { nome: '🎲 Basso', descr: 'qualche sorpresa' },
  alto: { nome: '🌪️ Alto', descr: 'twist quasi ogni round' },
};

/** A surprise mechanical twist drawn for a dilemma round (4.3), mirror of the
 * server's twists.ts `Twist`. */
export interface Twist {
  id:
    | 'difesa-lampo'
    | 'interventi-vietati'
    | 'doppio-difensore'
    | 'avvocato-opposto'
    | 'duello-botta-risposta'
    | 'voto-pesato'
    | 'dieci-parole';
  label: string;
  description: string;
}

/** The game's objective, stated to players (persuasion framing). */
export const OBJECTIVE =
  'Convinci gli altri a passare dalla tua parte… e resta pronto a cambiare idea tu.';

/** Three-step "how to play", shown to players on their phone before the game. */
export const HOW_TO_PLAY: readonly string[] = [
  'Scegli la tua posizione sul telefono.',
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
  // 100% unanimous first vote: short celebratory beat replacing the whole
  // debate; the dilemma is then swapped for a fresh one at the same index
  // (mirror server phases.ts).
  | 'UNANIMOUS_REVEAL'
  | 'PREDICT'
  | 'DEFENSE'
  | 'INTERVENTI'
  | 'VOTE_2'
  | 'SPEAKER_VOTE'
  | 'PHASE_RESULTS'
  // "La Mente del Gruppo" breather round (4.1, mirror server phases.ts).
  | 'GROUP_MIND'
  | 'GROUP_MIND_REVEAL'
  // "In Altre Parole" write+vote breather round (4.2, mirror server phases.ts).
  | 'WRITE'
  | 'WRITE_VOTE'
  | 'WRITE_REVEAL'
  // "Termometro (Hot Take 1–10)" slider mini-game.
  | 'HOT_TAKE_VOTE'
  | 'HOT_TAKE_REVEAL'
  // "Cruciverba Show" turn-based TV crossword mini-game.
  | 'CRUCIVERBA'
  | 'CRUCIVERBA_REVEAL'
  // "Tribunale degli Amici" 2-contender courtroom duel + jury verdict.
  | 'TRIBUNALE_ARGUE'
  | 'TRIBUNALE_VOTE'
  | 'TRIBUNALE_REVEAL'
  // "Telepatia" silent 1-word sync mini-game.
  | 'TELEPATHY'
  | 'TELEPATHY_REVEAL'
  // "Percorso" mode chapter framing (mirror server phases.ts).
  | 'TAPPA_INTRO'
  | 'TAPPA_RECAP'
  // "Storie" mode narrative framing (mirror server phases.ts).
  | 'STORY_INTRO'
  | 'SCENE_INTRO'
  | 'SCENE_CONSEQUENCE'
  | 'STORY_EPILOGUE'
  | 'ACCUSE'
  | 'FINAL_AWARDS'
  // "Percorso in 2" (the rebuilt duello, mirror server phases.ts): three fixed
  // acts (Sintonia / A parti invertite / Schierati) + the couple portrait.
  | 'DUO_ACT_INTRO'
  | 'DUO_PICK_PREDICT'
  | 'DUO_SYNC_REVEAL'
  | 'DUO_SIDE_PICK'
  | 'DUO_ARGUE'
  | 'DUO_WAVER'
  | 'DUO_ROUND_RESULT'
  | 'DUO_PICK'
  | 'DUO_REVEAL'
  | 'DUO_REPICK'
  | 'DUO_PORTRAIT';

export interface PlayerJoinPayload {
  code: string;
  nickname: string;
  /** Secret reconnect token from a previous session (localStorage); reclaims the seat. */
  token?: string;
}

/** A player's participation role (3.1, mirror of the server's PlayerRole). */
export type PlayerRole = 'giocatore' | 'pubblico';

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
  /** 'pubblico' when this player joined past the giocatori cap; absent = 'giocatore'. */
  role?: PlayerRole;
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
  /** Session format: 'classic' (3/5/7, default), 'percorso' (ascent) or 'storia' (narrative). */
  format?: 'classic' | 'percorso' | 'storia';
  /** Classic: number of dilemmas. Ignored (and may be omitted) in percorso/storia. */
  dilemmaCount?: number;
  /** Classic: content register. Ignored (and may be omitted) in percorso/storia. */
  register?: ContentRegister;
  /** Percorso: tappa to start the ascent from (1..4). */
  startTappa?: number;
  /** Percorso: duration preset. */
  durata?: Durata;
  /** Storia: the chosen story id. */
  storyId?: string;
  /** Game mode; defaults to 'gruppo' server-side when omitted (always gruppo in percorso). */
  mode?: GameMode;
  /** Enable "L'Infiltrato" (gruppo + ≥4 humans); defaults off. */
  infiltrato?: boolean;
  /** Enable "Squadre" (gruppo + ≥4 players); defaults off. */
  squadre?: boolean;
  /** Optional revamped party mode. */
  partyMode?: PartyMode;
  /** Coppie & Scintille intensity ('complicita' | 'piccante'). */
  partyIntensity?: PartyIntensity;
  /** Custom evening theme. */
  theme?: string;
  /** Optional explicit 2-player pairs for Coppie & Scintille mode. */
  couples?: Array<[string, string]>;
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
  /** How many rounds the infiltrator used their sabotage tool (4.5, "il replay delle sue mosse"). */
  toolUses: number;
}

/** Public dilemma shown on the shared screen: the prompt + its two options. */
/** Debate-complexity tier (mirror server deck.ts): sorbetto < alto < max < power. */
export type Complessita = 'sorbetto' | 'alto' | 'max' | 'power';

/** Host/phone badge labels for each complexity tier. */
export const COMPLESSITA_LABELS: Record<Complessita, string> = {
  sorbetto: '🍧 Sorbetto',
  alto: '◆ Alto',
  max: '◆◆ Max',
  power: '◆◆◆ Power',
};

export interface PublicDilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Debate-complexity tier; shown as a small badge. May be absent on legacy data. */
  complessita?: Complessita;
  /** Insegnamento per il mondo reale: spunto psicologico / pratico rivelato ai risultati. */
  lezioneReale?: string;
  /** Domanda di rilancio post-voto per stimolare il confronto dal vivo tra amici. */
  domandaRilancio?: string;
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
  /** When the current turn started (epoch ms); source for the count-up timer. */
  startedAt: number | null;
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
  /** True when the leading side itself changed (the stronger of the two
   * "ribaltone" triggers, the other being switched >= 2). */
  leadFlipped: boolean;
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
  | 'spaccalastanza'
  | 'telepate'
  | 'mentecollettiva'
  | 'sincronia'
  | 'pennadoro'
  | 'lettoregruppo'
  | 'avvocato'
  // Jolly pool (2.5): each goes to an otherwise empty-handed player.
  | 'fulmine'
  | 'sfinge'
  | 'partecipante';

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

/** One row of the final "Punti Serata" ranking (rank 1..3 stand on the podium). */
export interface PodiumEntry {
  player: PublicPlayer;
  points: number;
  rank: number;
}

/** "Momenti nominati" (5.5, mirror of the server's `NamedMomentKind`). */
export type NamedMomentKind = 'plebiscito' | 'paritario' | 'ribaltone' | 'triplaPersuasione';

/** A titled, detected moment from one round — "I momenti della serata". */
export interface NamedMoment {
  kind: NamedMomentKind;
  dilemmaIndex: number;
  title: string;
  description: string;
  emoji: string;
  playerId?: string;
  playerNickname?: string;
}

/** Percorso in 2: which act is in play and the position within it (never secret). */
export interface DuoActState {
  act: number;
  roundInAct: number;
  roundsInAct: number;
  totalActs: number;
}

/** Display metadata for the three duo acts (act-intro cards, host badges). */
export const DUO_ACT_META: Record<number, { emoji: string; nome: string; sottotitolo: string }> = {
  1: {
    emoji: '🔮',
    nome: 'Atto I — Sintonia',
    sottotitolo: 'Scegli il tuo lato e prevedi quello di chi hai davanti.',
  },
  2: {
    emoji: '🎭',
    nome: 'Atto II — A parti invertite',
    sottotitolo: 'Il gioco vi assegna i lati: difendi quello che non è tuo.',
  },
  3: {
    emoji: '⚔️',
    nome: 'Atto III — Schierati',
    sottotitolo: 'Il duello vero: convinci, o lasciati convincere.',
  },
};

/** Atto I reveal (DUO_SYNC_REVEAL): both picks + prediction hits + sintonia counters. */
export interface DuoSyncReveal {
  picks: Array<{ id: string; nickname: string; choice: VoteChoice }>;
  predictions: Array<{ id: string; nickname: string; predicted: VoteChoice; correct: boolean }>;
  agreed: boolean;
  agreements: number;
  truePicks: number;
}

/** Duo argue turn (DUO_ARGUE): who argues now, on which (possibly assigned) side. */
export interface DuoTurn {
  speaker: {
    id: string;
    nickname: string;
    side: VoteChoice;
    /** Atto II: arguing a side that is not their pick. */
    inverted: boolean;
    /** Atto III twist: the designated devil's advocate. */
    advocate: boolean;
  } | null;
  listenerId: string | null;
  turn: number;
  totalTurns: number;
  minEndsAt: number | null;
  canFinish: boolean;
  startedAt: number | null;
}

/** Duo round outcome (DUO_ROUND_RESULT): act-shaped points + running totals. */
export interface DuoRoundResult {
  act: number;
  advocacy: boolean;
  vacillare: Array<{ id: string; nickname: string; received: 0 | 1 | 2 }>;
  convinced: Array<{
    persuader: { id: string; nickname: string };
    convinced: { id: string; nickname: string };
    ribaltone: boolean;
  }>;
  scores: Array<{ id: string; nickname: string; total: number }>;
}

/** A duo highlight surfaced in the portrait ("il momento della serata"). */
export interface DuoMomentView {
  emoji: string;
  title: string;
  description: string;
  playerId?: string;
}

/** One of the two playful titles each player earns at the portrait. */
export interface DuoTitle {
  playerId: string;
  nickname: string;
  emoji: string;
  title: string;
  description: string;
}

/** The couple portrait (DUO_PORTRAIT): the finale's whole payload. */
export interface DuoPortrait {
  sintoniaPct: number;
  agreements: number;
  truePicks: number;
  tiConosco: Array<{ id: string; nickname: string; hits: number }>;
  scores: Array<{ id: string; nickname: string; total: number }>;
  /** The playful micro-verdict's winner; null on a perfect tie. */
  winnerId: string | null;
  momento: DuoMomentView | null;
  titoli: DuoTitle[];
}

/** Per-tappa progress within a percorso (mirror server PercorsoTappaProgress). */
export interface PercorsoTappaProgress {
  id: number;
  total: number;
  done: number;
}

/** Secret-safe percorso view (mirror server PercorsoView); null in classic. */
export interface PercorsoView {
  percorsoId?: PercorsoId;
  startTappa: number;
  durata: Durata;
  currentTappa: number | null;
  totalDilemmas: number;
  dilemmaIndex: number;
  tappe: PercorsoTappaProgress[];
  tappaDilemmas: number;
  tappaSwings: number;
}

// ---------------------------------------------------------------------------
// "Storie" mode — narrative tales with debated crossroads (mirror server
// storie.ts). The host reads the prose aloud (TTS); phones mirror it as text.
// ---------------------------------------------------------------------------

/** Narrative sub-flavors (all stories are sci-fi-framed). Mirror server STORY_GENRES. */
export const STORY_GENRES = ['avventura', 'scifi', 'giallo', 'dramma'] as const;
export type StoryGenre = (typeof STORY_GENRES)[number];

/** Host-facing label for each sci-fi sub-flavor. */
export const STORY_GENRE_LABELS: Record<StoryGenre, string> = {
  avventura: 'Sopravvivenza',
  scifi: 'Distopia / IA',
  giallo: 'Mistero',
  dramma: 'Dramma umano',
};

/** A lightweight story-catalog entry for the leader's picker (mirror server StoriaCatalogItem). */
export interface StoriaCatalogItem {
  id: string;
  title: string;
  genre: StoryGenre;
  emoji: string;
  hook: string;
  durataStimaMin: number;
  /** Number of crossroads (debate rounds) in the story. */
  scene: number;
  familiarita?: 'vecchi_amici' | 'nuove_conoscenze' | 'tutti';
}

/** Secret-safe storia view (mirror server StoriaView); null in classic/percorso. */
export interface StoriaView {
  storyId: string;
  title: string;
  protagonist: string;
  emoji: string;
  premessa: string;
  actTitle: string | null;
  sceneNarration: string | null;
  sceneIndex: number;
  totalScenes: number;
  decision: VoteChoice | null;
  consequence: string | null;
  epilogo: string | null;
  decisionsA: number;
}

export interface GameStatePayload {
  phase: GamePhase;
  dilemmaCount: number | null;
  /** Content register chosen at start; null in the lobby (and always null in percorso). */
  register: ContentRegister | null;
  /** Session format of the room. */
  format: 'classic' | 'percorso' | 'storia';
  /** Percorso view (progress + tappe), or null in classic / before start. */
  percorso: PercorsoView | null;
  /** Available dilemmas per tappa — static setup data for the percorso estimate. */
  tappaCounts: TappaCounts;
  /** Available dilemmas per percorsoId & tappa. */
  percorsoCounts?: PercorsoCounts;
  /** Storia narrative view (prose + progress), or null in classic/percorso. */
  storia: StoriaView | null;
  /** The story catalog — static setup data for the storia picker. */
  storieCatalog: StoriaCatalogItem[];
  /** Which dilemma (1-based) is in play; 0 before the first reveal. */
  dilemmaIndex: number;
  /** Epoch ms when the phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** Epoch ms when the current individual turn (e.g. Cruciverba 15s / Tribunale 15s) expires; null otherwise. */
  turnExpiresAt?: number | null;
  /** Epoch ms when a pre-debate reading grace window ends before the 15s timer starts; null otherwise. */
  readingEndsAt?: number | null;
  /** True while the leader has paused the game; no phase advances until they
   * resume. The countdown (phaseExpiresAt) is null while paused. */
  paused: boolean;
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
   * Nicknames of connected players still missing their vote/confirmation
   * this voting phase (VOTE_1/VOTE_2/DUO_SIDE_PICK/DUO_PICK/DUO_REPICK); null otherwise.
   * Never reveals which choice — presence only.
   */
  missingVoters: string[] | null;
  /**
   * How many players have made a secret prediction this round (PREDICT phase).
   * Aggregate count only — never who predicted what.
   */
  predictedCount: number;
  /**
   * Nicknames of connected humans still missing a PREDICT-phase action
   * (prediction, swing bet, or — in the know round — their guess); null
   * outside PREDICT.
   */
  missingPredictors: string[] | null;
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
  /** "L'Infiltrato col merito" (4.5): whether the once-per-round sabotage tool
   * has already been used this round — public, doesn't reveal who. */
  infiltratoToolUsed: boolean;
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
   * The unanimous side + how many voted it, shown only in UNANIMOUS_REVEAL;
   * null otherwise. Aggregate only, no identities.
   */
  unanimous: { side: VoteChoice; count: number } | null;
  /**
   * Who is speaking + turn progress, shown only in DEFENSE; null otherwise.
   * Only the chosen defenders' identities/side are public.
   */
  defense: DefenseState | null;
  /**
   * The just-finished speaker's applause tally ("applausometro"); null before
   * any turn has ended this round, or if it drew no reactions.
   */
  lastTurnApplause: { speakerId: string; nickname: string; tally: Partial<Record<Reaction, number>> } | null;
  /**
   * True in the surprise "Avvocato del Diavolo" round (defenders argue the side
   * they did NOT vote). Revealed only from DEFENSE on; false otherwise.
   */
  isDevilRound: boolean;
  /**
   * True in the game's FINAL round, where the swing bet pays double (6.2,
   * "posta doppia") — not a secret twist, always visible.
   */
  finalStakesRound: boolean;
  /**
   * This round's silly performance constraint for the defenders, public
   * during DEFENSE/INTERVENTI; null otherwise, or if this round drew none.
   */
  absurdConstraint: string | null;
  /**
   * This round's surprise mechanical twist (4.3), public during DEFENSE/
   * INTERVENTI; null otherwise, or if this round drew none.
   */
  twist: Twist | null;
  /** The room's caos dial (4.3), chosen at start. */
  caos: Caos;
  /** Termometro (Hot Take 1–10) prompt in HOT_TAKE_VOTE/HOT_TAKE_REVEAL; null otherwise. */
  hotTakePrompt?: HotTakePromptPayload | null;
  /** Termometro (Hot Take 1–10) reveal data in HOT_TAKE_REVEAL; null otherwise. */
  hotTakeReveal?: HotTakeRevealPayload | null;
  /** How many have submitted a Termometro score (aggregate only). */
  hotTakeSubmittedCount?: number;
  /** Nicknames still missing in HOT_TAKE_VOTE; null otherwise. */
  missingHotTakers?: string[] | null;
  /** "Cruciverba Show" board + 15s turn state; null outside CRUCIVERBA/CRUCIVERBA_REVEAL. */
  cruciverbaState?: CruciverbaStatePayload | null;
  /** "Tribunale degli Amici" state; null outside TRIBUNALE_* phases. */
  tribunaleState?: TribunaleStatePayload | null;
  /** "Telepatia" prompt; null outside TELEPATHY/TELEPATHY_REVEAL. */
  telepathyPrompt?: TelepathyPromptPayload | null;
  /** Live Telepatia submission progress during TELEPATHY; null otherwise. */
  telepathyProgress?: { done: number; total: number; missingNicknames: string[] } | null;
  /** Mind-sync clusters reveal in TELEPATHY_REVEAL; null otherwise. */
  telepathyReveal?: TelepathyRevealPayload | null;
  /**
   * The swing + per-defender attribution, shown only in PHASE_RESULTS; null
   * otherwise. Aggregate counts only — never who voted what.
   */
  swing: PublicSwing | null;
  /** The current dilemma's author nickname, shown only at PHASE_RESULTS; null otherwise. */
  dilemmaAuthor: string | null;
  /** The end-of-game awards, shown only in FINAL_AWARDS; null otherwise. */
  awards: Award[] | null;
  /** "I momenti della serata" (5.5): every titled moment across the game,
   * shown before the awards, only in FINAL_AWARDS; null otherwise. */
  namedMoments: NamedMoment[] | null;
  /** The final "Punti Serata" podium/ranking, best first, only in FINAL_AWARDS; null otherwise. */
  podium: PodiumEntry[] | null;
  /** Game mode of the room; 'gruppo' until/unless a duel is started. */
  mode: GameMode;
  /** The leader-player's id (drives the game); null until a leader exists. */
  leaderId: string | null;
  /** Percorso in 2: act progress (in-game duello only; null otherwise). */
  duoAct: DuoActState | null;
  /** The twist round's devil's advocate id, public only while it plays out. */
  duoAdvocateId: string | null;
  /** How many players submitted their Atto I pick+prediction (aggregate only). */
  duoSyncedCount: number;
  /** How many "ti ha fatto vacillare?" ratings are in (aggregate only). */
  duoWaverCount: number;
  /** Atto I reveal, shown only in DUO_SYNC_REVEAL; null otherwise. */
  duoSyncReveal: DuoSyncReveal | null;
  /** Current arringa turn, shown only in DUO_ARGUE; null otherwise. */
  duoTurn: DuoTurn | null;
  /** Round outcome, shown only in DUO_ROUND_RESULT; null otherwise. */
  duoRoundResult: DuoRoundResult | null;
  /** The couple portrait, shown only in DUO_PORTRAIT; null otherwise. */
  duoPortrait: DuoPortrait | null;
  /** "La Mente del Gruppo" (4.1): the current question; null outside GROUP_MIND/GROUP_MIND_REVEAL. */
  groupMindQuestion: GroupMindQuestion | null;
  /** Who's still missing their answer+guess this round; null outside GROUP_MIND. */
  groupMindProgress: { done: number; total: number; missingNicknames: string[] } | null;
  /** The aggregate A/B split + correct-guesser count, shown only in GROUP_MIND_REVEAL; null otherwise. */
  groupMindTally: { A: number; B: number; correctGuessers: number } | null;
  /** "In Altre Parole" (4.2): the current prompt; null outside WRITE/WRITE_VOTE/WRITE_REVEAL. */
  writePrompt: WritePrompt | null;
  /** Who's still missing their written answer this round; null outside WRITE. */
  writeProgress: { done: number; total: number; missingNicknames: string[] } | null;
  /** The anonymized answer list (own entry included — filter it out client-side), shown only in WRITE_VOTE; null otherwise. */
  writtenAnswers: PublicWrittenAnswer[] | null;
  /** Who's still missing their vote this round; null outside WRITE_VOTE. */
  writeVoteProgress: { done: number; total: number; missingNicknames: string[] } | null;
  /** Each answer with its author + vote count, shown only in WRITE_REVEAL; null otherwise. */
  writeReveal: WriteRevealAnswer[] | null;
  /** Active revamped party mode (if playing in one of the 4 new formats). */
  partyMode?: PartyMode;
  /** Active party card metadata and mode-specific state; null if classic mode. */
  partyCard?: PartyCardPayload | null;
}

/** "La Mente del Gruppo" (4.1): a short A/B question everyone answers + predicts. */
export interface GroupMindQuestion {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
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

/** A signed-in user's editable profile (GET/PUT /api/me/profile). `avatar` is a
 *  `preset:<id>` or a small raster data-URL; null means none chosen. */
export interface MyProfile {
  displayName: string | null;
  avatar: string | null;
}

/** Payload of GET /api/me/dashboard: stats + recent games + a small awards preview. */
export interface MyDashboard {
  stats: MyStats;
  recentGames: MyGameRecord[];
  recentAwards: Pick<MyAward, 'id' | 'awardId' | 'title' | 'emoji' | 'description' | 'nickname' | 'wonAt'>[];
  profile: MyProfile;
}

export interface PlayerVotePayload {
  choice: VoteChoice;
}

export interface PlayerVotedPayload {
  choice: VoteChoice | PreferirestiChoice;
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

export interface PlayerGroupMindPayload {
  answer: VoteChoice;
  guess: VoteChoice;
}

export interface PlayerGroupMindSubmittedPayload {
  answer: VoteChoice;
  guess: VoteChoice;
}

/** Private per-player outcome at GROUP_MIND_REVEAL (mirror of the server's `GroupMindOutcome`). */
export interface PlayerGroupMindResultPayload {
  guess: VoteChoice;
  /** The room's majority answer, or null on a tie. */
  actual: VoteChoice | null;
  correct: boolean;
}

export type GroupMindError = 'ROOM_NOT_FOUND' | 'NOT_GROUP_MIND_PHASE' | 'NOT_IN_ROOM' | 'INVALID_CHOICE';

/** "In Altre Parole" (4.2): a short free-text prompt everyone answers. */
export interface WritePrompt {
  id: string;
  text: string;
}

/** One anonymized written answer in the round's frozen shuffled order. `id` is
 * the author's player id — filter out your own to avoid voting for yourself. */
export interface PublicWrittenAnswer {
  id: string;
  text: string;
}

/** One answer with its author + vote count, revealed only at WRITE_REVEAL. */
export interface WriteRevealAnswer {
  id: string;
  text: string;
  authorNickname: string;
  votes: number;
}

export interface PlayerWritePayload {
  text: string;
}

export interface PlayerWriteSubmittedPayload {
  text: string;
}

export type WriteError = 'ROOM_NOT_FOUND' | 'NOT_WRITE_PHASE' | 'NOT_IN_ROOM' | 'EMPTY' | 'TOO_LONG';

export interface PlayerWriteVotePayload {
  /** Opaque per-round token (an answer's position in writeOrder) — never a
   * real player id, or the public roster would de-anonymize the vote. */
  votedForToken: string;
}

export interface PlayerWriteVotedPayload {
  votedForToken: string;
}

/** Privately sent once entering WRITE_VOTE (and on reconnect): this player's
 * own answer's opaque token, so the client can filter its own entry out of
 * the anonymized list without ever learning another author's real id. */
export interface PlayerMyWriteTokenPayload {
  token: string;
}

export type WriteVoteError = 'ROOM_NOT_FOUND' | 'NOT_WRITE_VOTE_PHASE' | 'NOT_IN_ROOM' | 'SELF_VOTE' | 'INVALID_TARGET';

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
export const MAX_SUBMISSIONS_PER_ACCOUNT = 5;

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

export type RaiseHandError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_RAISE_PHASE'
  | 'NOT_IN_ROOM'
  | 'IS_SPEAKER'
  | 'QUEUE_FULL'
  | 'PUBBLICO_NEVER_DEFENDS'
  | 'INTERVENTI_DISABLED_THIS_ROUND';

export interface PlayerRaiseHandErrorPayload {
  error: RaiseHandError;
}

/** User-facing (Italian) messages for hand-raise errors. Only QUEUE_FULL is
 * normally reachable (the raise button is only shown when the phase/turn
 * already make the others valid) — the rest are defensive fallbacks. */
export const RAISE_HAND_ERROR_MESSAGES: Record<RaiseHandError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_RAISE_PHASE: 'Non è il momento di alzare la mano',
  NOT_IN_ROOM: 'Non sei in questa stanza',
  IS_SPEAKER: 'Stai già parlando tu',
  QUEUE_FULL: 'Coda piena — reagisci! 👏',
  PUBBLICO_NEVER_DEFENDS: 'Il Pubblico segue, non interviene 🎟️',
  INTERVENTI_DISABLED_THIS_ROUND: 'Niente interventi in questo round 🤐',
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

export type InfiltratoToolError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_INFILTRATOR'
  | 'NOT_DEFENSE_PHASE'
  | 'ALREADY_USED_THIS_ROUND'
  | 'NO_ONE_SPEAKING';

export interface PlayerInfiltratoToolErrorPayload {
  error: InfiltratoToolError;
}

/** User-facing (Italian) messages for infiltrato-tool errors. Mostly defensive
 * fallbacks — the button is only shown when the phase/turn already make sense. */
export const INFILTRATO_TOOL_ERROR_MESSAGES: Record<InfiltratoToolError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_INFILTRATOR: 'Non sei tu la spia',
  NOT_DEFENSE_PHASE: 'Non è il momento di agire',
  ALREADY_USED_THIS_ROUND: 'Hai già agito in questo round',
  NO_ONE_SPEAKING: 'Nessuno sta parlando ora',
};

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

/**
 * How many seconds of SPLIT_REVEAL, at the END of its countdown, are the
 * actual reveal window — the seconds before that (server total minus this)
 * are a "3-2-1" suspense beat with the split withheld. Must mirror the
 * server's PHASE_DURATIONS_MS.SPLIT_REVEAL (currently 9s = 3s suspense + 6s
 * reveal, this constant being that 6s).
 */
export const SPLIT_REVEAL_WINDOW_S = 6;

/** User-facing (Italian) short label for each phase, shown on the host. */
export const PHASE_LABELS: Record<GamePhase, string> = {
  LOBBY: 'In attesa',
  PHASE_INTRO: 'Si comincia',
  DILEMMA_REVEAL: 'Il dilemma',
  VOTE_1: 'Primo voto',
  SPLIT_REVEAL: 'Come si è diviso il gruppo',
  UNANIMOUS_REVEAL: "Tutti d'accordo!",
  PREDICT: 'Pronostico',
  DEFENSE: 'Le difese',
  INTERVENTI: 'Interventi',
  VOTE_2: 'Secondo voto',
  SPEAKER_VOTE: "Chi ti ha strappato l'applauso",
  PHASE_RESULTS: 'Risultati',
  GROUP_MIND: 'La mente del gruppo',
  GROUP_MIND_REVEAL: 'Chi legge il gruppo',
  WRITE: 'In altre parole',
  WRITE_VOTE: 'Votate la risposta migliore',
  WRITE_REVEAL: 'Chi ha scritto cosa',
  HOT_TAKE_VOTE: 'Termometro 1–10',
  HOT_TAKE_REVEAL: 'Gli estremi del gruppo',
  CRUCIVERBA: 'Cruciverba Show',
  CRUCIVERBA_REVEAL: 'Tabellone risolto',
  TRIBUNALE_ARGUE: 'Tribunale degli Amici',
  TRIBUNALE_VOTE: 'Il verdetto della giuria',
  TRIBUNALE_REVEAL: 'Sentenza!',
  TELEPATHY: 'Telepatia',
  TELEPATHY_REVEAL: 'Sintonia mentale',
  TAPPA_INTRO: 'Nuova tappa',
  TAPPA_RECAP: 'Fine tappa',
  STORY_INTRO: 'La storia',
  SCENE_INTRO: 'La scena',
  SCENE_CONSEQUENCE: 'Cosa succede',
  STORY_EPILOGUE: 'Epilogo',
  ACCUSE: "Chi era l'infiltrato?",
  FINAL_AWARDS: 'Premi finali',
  DUO_ACT_INTRO: 'Nuovo atto',
  DUO_PICK_PREDICT: 'Scegli e prevedi',
  DUO_SYNC_REVEAL: 'Sintonia',
  DUO_SIDE_PICK: 'Da che parte stai?',
  DUO_ARGUE: 'Arringa',
  DUO_WAVER: 'Ti ha fatto vacillare?',
  DUO_ROUND_RESULT: 'Esito del round',
  DUO_PICK: 'Schierati',
  DUO_REVEAL: 'Rivelazione',
  DUO_REPICK: 'Confermi o cambi?',
  DUO_PORTRAIT: 'Ritratto di coppia',
};

export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_HUMAN_PLAYERS'
  | 'WRONG_PLAYER_COUNT'
  | 'INVALID_DILEMMA_COUNT'
  | 'INVALID_REGISTER'
  | 'INVALID_PERCORSO'
  | 'INVALID_STORIA'
  | 'INFILTRATO_NEEDS_PLAYERS'
  | 'SQUADRE_NEEDS_PLAYERS'
  | 'EVEN_PLAYERS_REQUIRED'
  | 'ALREADY_STARTED';

export interface HostStartErrorPayload {
  error: StartGameError;
}

/** User-facing (Italian) messages for start-game errors. */
export const START_ERROR_MESSAGES: Record<StartGameError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_ENOUGH_PLAYERS: 'Servono più giocatori per questa modalità',
  NO_HUMAN_PLAYERS: 'Serve almeno una persona in carne e ossa',
  WRONG_PLAYER_COUNT: 'Il Percorso in 2 richiede esattamente 2 giocatori',
  INVALID_DILEMMA_COUNT: 'Numero di dilemmi non valido',
  INVALID_REGISTER: 'Registro non valido',
  INVALID_PERCORSO: 'Configurazione del percorso non valida',
  INVALID_STORIA: 'Storia non valida',
  INFILTRATO_NEEDS_PLAYERS: "L'Infiltrato richiede almeno 4 persone",
  SQUADRE_NEEDS_PLAYERS: 'Le Squadre richiedono almeno 4 giocatori',
  EVEN_PLAYERS_REQUIRED: 'Coppie & Scintille richiede un numero pari di giocatori (2, 4, 6 o 8)',
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
