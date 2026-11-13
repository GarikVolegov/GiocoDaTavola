// "La Mente del Gruppo" (4.1): a short, all-active breather round dropped
// between dilemmas — everyone answers a quick A/B question about themselves
// AND predicts what the group's majority will answer, then a brief aggregate
// reveal shows who "reads the room". No defense/spotlight step, so it stays
// fast even in large groups. Operates on a Room; type-only import keeps it
// cycle-free (mirrors knowRound.ts / predictions.ts).
import type { Room, VoteChoice } from './rooms';
import { pickByFamiliarita, type DilemmaFamiliarita, type Familiarita } from './deck';
import { tally, isVoteChoice } from './voteCount';

export interface GroupMindQuestion {
  id: string;
  /** The short A/B question shown to everyone, e.g. "Soldi o tempo libero?". */
  prompt: string;
  optionA: string;
  optionB: string;
  familiarita?: DilemmaFamiliarita;
}

/** A small starter bank (vita + business), same spirit as the deck's dilemmas
 * but lighter — no defense, so no need for register/mood/complexity tagging. */
export const GROUP_MIND_QUESTIONS: GroupMindQuestion[] = [
  { id: 'gm01', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Soldi', optionB: 'Tempo libero' },
  { id: 'gm02', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Mare', optionB: 'Montagna', familiarita: 'nuove_conoscenze' },
  { id: 'gm03', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Colazione dolce', optionB: 'Colazione salata', familiarita: 'nuove_conoscenze' },
  { id: 'gm04', prompt: 'Secondo la maggioranza del gruppo, meglio…', optionA: 'Arrivare sempre in anticipo', optionB: 'Arrivare sempre giusti giusti' },
  { id: 'gm05', prompt: 'La maggioranza licenzierebbe l\'amico-dipendente che rende poco?', optionA: 'Sì, licenziarlo', optionB: 'No, tenerlo' },
  { id: 'gm06', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Un anno sabbatico', optionB: 'Una promozione' },
  { id: 'gm07', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Cena tra amici', optionB: 'Serata da soli' },
  { id: 'gm08', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Rischiare e vincere grosso', optionB: 'Andare sul sicuro' },
  { id: 'gm09', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Capo severo ma giusto', optionB: 'Capo simpatico ma disorganizzato' },
  { id: 'gm10', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Vivere in città', optionB: 'Vivere in campagna' },
  { id: 'gm11', prompt: 'Cosa preferisce la maggioranza del gruppo in vacanza?', optionA: 'Tutto organizzato al minuto', optionB: 'All’avventura senza piani' },
  { id: 'gm12', prompt: 'Secondo la maggioranza, chi paga al primo appuntamento?', optionA: 'Chi invita', optionB: 'Alla romana' },
  { id: 'gm13', prompt: 'La maggioranza del gruppo perdonerebbe un tradimento?', optionA: 'Mai', optionB: 'Dipende dal contesto' },
  { id: 'gm14', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Lavorare da casa per sempre', optionB: 'Ufficio ibrido coi colleghi' },
  { id: 'gm15', prompt: 'Cosa controlla prima la maggioranza appena sveglia?', optionA: 'Messaggi e social', optionB: 'Caffè e silenzio' },
  { id: 'gm16', prompt: 'Secondo la maggioranza, il migliore amico può uscire con la tua ex?', optionA: 'Mai nella vita', optionB: 'Se è passato tempo, sì' },
  { id: 'gm17', prompt: 'Cosa sceglie la maggioranza?', optionA: 'Sapere la data esatta della propria morte', optionB: 'Non saperla mai' },
  { id: 'gm18', prompt: 'La maggioranza preferisce ricevere…', optionA: 'Una verità scomoda subito', optionB: 'Una bugia bianca per stare sereni' },
  { id: 'gm19', prompt: 'A cena fuori con questo gruppo, la maggioranza preferisce…', optionA: 'Dividere il conto equo', optionB: 'Ognuno paga il suo' },
  { id: 'gm20', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Tornare indietro di 10 anni con la testa di oggi', optionB: 'Avere 1 milione di euro oggi' },
  { id: 'gm21', prompt: 'La maggioranza del gruppo ama di più…', optionA: 'I cani', optionB: 'I gatti', familiarita: 'nuove_conoscenze' },
  { id: 'gm22', prompt: 'Cosa fa la maggioranza quando trova 50€ per terra?', optionA: 'Li tiene senza pensarci', optionB: 'Cerca di capire di chi sono' },
  { id: 'gm23', prompt: 'Secondo la maggioranza, nella vita conta di più…', optionA: 'La fortuna', optionB: 'Il merito' },
  { id: 'gm24', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Essere famosi ma criticati', optionB: 'Ricchi ma sconosciuti' },
  { id: 'gm25', prompt: 'In un gruppo WhatsApp, la maggioranza è più…', optionA: 'Quelli che mandano vocali da 4 minuti', optionB: 'Quelli che rispondono solo con emoji' },
  { id: 'gm26', prompt: 'Cosa sceglie la maggioranza?', optionA: 'Niente telefono per 1 mese', optionB: 'Niente doccia calda per 1 mese' },
  { id: 'gm27', prompt: 'La maggioranza del gruppo preferisce…', optionA: 'Un lavoro noioso da 5.000€/mese', optionB: 'Un lavoro da sogno da 1.800€/mese' },
  { id: 'gm28', prompt: 'Cosa sceglierebbe la maggioranza stasera?', optionA: 'Notte brava fino alle 5', optionB: 'A letto alle 23 felici' },
  { id: 'gm29', prompt: 'Secondo la maggioranza, si può essere amici con un/una ex?', optionA: 'Sì, senza problemi', optionB: 'No, è sempre un casino' },
  { id: 'gm30', prompt: 'Cosa sceglie la maggioranza del gruppo?', optionA: 'Viaggiare nel passato', optionB: 'Viaggiare nel futuro' },
  { id: 'gm31', prompt: 'Al ristorante, la maggioranza…', optionA: 'Ordina sempre lo stesso piatto sicuro', optionB: 'Prova la cosa più strana del menu' },
  { id: 'gm32', prompt: 'Cosa fa più paura alla maggioranza?', optionA: 'Restare senza soldi', optionB: 'Restare soli' },
  { id: 'gm33', prompt: 'La maggioranza accetterebbe di lavorare 4 giorni a settimana per il 15% in meno?', optionA: 'Sì, subito', optionB: 'No, voglio lo stipendio pieno' },
  { id: 'gm34', prompt: 'Cosa sceglie la maggioranza?', optionA: 'Leggere i pensieri degli altri', optionB: 'Essere invisibili' },
  { id: 'gm35', prompt: 'Se il gruppo aprisse un’azienda insieme, fallirebbe per…', optionA: 'Troppe discussioni e zero decisioni', optionB: 'Zero voglia di lavorare' },
  { id: 'gm36', prompt: 'La maggioranza del gruppo ammette di aver…', optionA: 'Ghostato qualcuno di recente', optionB: 'Stalkerato un profilo stanotte' },
  { id: 'gm37', prompt: 'In questo gruppo, la maggioranza preferisce…', optionA: 'Sentirsi dire una verità scomoda', optionB: 'Tenere la pace anche col silenzio', familiarita: 'vecchi_amici' },
  { id: 'gm38', prompt: 'Se un amico sparisce quando si fidanza, la maggioranza…', optionA: 'Lo capisce senza rancore', optionB: 'Glielo fa pesare appena torna', familiarita: 'vecchi_amici' },
  { id: 'gm39', prompt: 'Quando organizzate qualcosa insieme, la maggioranza…', optionA: 'Aspetta che decida qualcun altro', optionB: 'Propone e spinge subito', familiarita: 'vecchi_amici' },
  { id: 'gm40', prompt: 'Tra di noi, la maggioranza sente che negli ultimi anni…', optionA: 'Siamo cresciuti insieme', optionB: 'Ognuno ha preso un ritmo diverso', familiarita: 'vecchi_amici' },
  { id: 'gm41', prompt: 'In questo gruppo, la maggioranza accetta una critica vera…', optionA: 'Solo se detta da soli', optionB: 'Anche davanti a tutti con ironia', familiarita: 'vecchi_amici' },
  { id: 'gm42', prompt: 'Alla fine di una serata, la maggioranza pensa che…', optionA: 'Ci vediamo troppo poco', optionB: 'Ci vediamo il giusto', familiarita: 'vecchi_amici' },
];

/**
 * Every 2nd dilemma (never the last), the group loop detours through a
 * GROUP_MIND round instead of going straight to the next DILEMMA_REVEAL —
 * classic format only (rooms.ts gates the format check). `dilemmaIndex` is
 * the just-finished round's 1-based index.
 */
export function isGroupMindCheckpoint(dilemmaIndex: number, dilemmaCount: number): boolean {
  return dilemmaIndex > 0 && dilemmaIndex % 2 === 0 && dilemmaIndex < dilemmaCount;
}

/** Pick a question not yet used this game; null once the (small) bank is exhausted. */
export function pickGroupMindQuestion(
  usedIds: Set<string>,
  rng: () => number,
  familiarita: Familiarita = 'misto',
): GroupMindQuestion | null {
  const pool = GROUP_MIND_QUESTIONS.filter((q) => !usedIds.has(q.id));
  return pickByFamiliarita(pool, familiarita, rng);
}

/** Cast each bot's (random) answer + majority guess immediately on GROUP_MIND entry. */
export function castBotGroupMind(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    room.groupMindAnswers.set(p.id, rng() < 0.5 ? 'A' : 'B');
    room.groupMindGuesses.set(p.id, rng() < 0.5 ? 'A' : 'B');
  }
}

export type GroupMindSubmitError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_GROUP_MIND_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_CHOICE';

export type GroupMindSubmitResult =
  | { ok: true; room: Room }
  | { ok: false; error: GroupMindSubmitError };

/** Record (or change) a player's own answer + majority prediction in one submission. */
export function submitGroupMind(
  room: Room,
  playerId: string,
  answer: string,
  guess: string,
): GroupMindSubmitResult {
  if (room.phase !== 'GROUP_MIND') return { ok: false, error: 'NOT_GROUP_MIND_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!isVoteChoice(answer) || !isVoteChoice(guess)) return { ok: false, error: 'INVALID_CHOICE' };
  room.groupMindAnswers.set(playerId, answer);
  room.groupMindGuesses.set(playerId, guess);
  return { ok: true, room };
}

/** Everyone this round is waiting on: connected humans (Pubblico included —
 * nothing here is a defense action), excluding this round's late-joiners. */
function presentSubmitters(room: Room) {
  return [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
}

/** How many have submitted both parts this round (aggregate only). */
export function groupMindSubmittedCount(room: Room): number {
  return [...room.groupMindAnswers.keys()].filter((id) => room.groupMindGuesses.has(id)).length;
}

/** Single source of truth for "has everyone finished GROUP_MIND?" (early-advance). */
export function groupMindPhaseComplete(room: Room): boolean {
  const present = presentSubmitters(room);
  if (present.length === 0) return false;
  return present.every((p) => room.groupMindAnswers.has(p.id) && room.groupMindGuesses.has(p.id));
}

/** Nicknames of connected humans still missing their submission; null outside GROUP_MIND. */
export function groupMindProgress(room: Room): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'GROUP_MIND') return null;
  const present = presentSubmitters(room);
  const missing = present.filter((p) => !room.groupMindAnswers.has(p.id) || !room.groupMindGuesses.has(p.id));
  return { done: present.length - missing.length, total: present.length, missingNicknames: missing.map((p) => p.nickname) };
}

/**
 * Force a plausible default for any connected human still missing a
 * submission once the phase is forced through (soft-timeout or leader skip):
 * both default to 'A'. Idempotent — a no-op for anyone who already answered.
 */
export function applyGroupMindDefaults(room: Room): void {
  if (room.phase !== 'GROUP_MIND') return;
  for (const p of presentSubmitters(room)) {
    if (!room.groupMindAnswers.has(p.id)) room.groupMindAnswers.set(p.id, 'A');
    if (!room.groupMindGuesses.has(p.id)) room.groupMindGuesses.set(p.id, 'A');
  }
}

/** The aggregate A/B split of everyone's OWN answers, gated to GROUP_MIND_REVEAL
 * (null otherwise). Counts only — individual answers stay secret. */
export function publicGroupMindTally(room: Room): { A: number; B: number; correctGuessers: number } | null {
  if (room.phase !== 'GROUP_MIND_REVEAL' || !room.groupMindQuestion) return null;
  const t = tally(room.groupMindAnswers);
  const majority: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
  const correctGuessers = majority
    ? [...room.groupMindGuesses.values()].filter((g) => g === majority).length
    : 0;
  return { A: t.A, B: t.B, correctGuessers };
}

/** One guesser's own outcome, for the private `player:groupMindResult` emit
 * on entry to GROUP_MIND_REVEAL. `actual` is the majority answer, null on a tie. */
export interface GroupMindOutcome {
  playerId: string;
  guess: VoteChoice;
  actual: VoteChoice | null;
  correct: boolean;
}

export function groupMindResults(room: Room): GroupMindOutcome[] {
  const t = tally(room.groupMindAnswers);
  const actual: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
  return [...room.groupMindGuesses].map(([playerId, guess]) => ({
    playerId,
    guess,
    actual,
    correct: actual != null && guess === actual,
  }));
}
