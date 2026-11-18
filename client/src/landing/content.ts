// Static marketing content for the landing page. Repeated data lives here so the
// section components stay declarative. Shared copy is reused from events.ts where
// it already exists (HOW_TO_PLAY, OBJECTIVE).

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  { icon: '🗳️', title: 'Centinaia di dilemmi, mai uguali', body: 'Scelte di vita, lavoro e morale: scomode, brillanti e perfette per accendere il dibattito.' },
  { icon: '🎯', title: 'Vince chi convince', body: 'Non conta avere ragione: conta far cambiare idea agli altri… e saperla cambiare al momento giusto.' },
  { icon: '👤', title: 'In gruppo o da solo, senza timer', body: 'Gioca da solo, passando un telefono o creando una stanza: zero fretta e ritmo deciso da voi.' },
  { icon: '🎉', title: 'Nessuno perde', body: 'A fine serata premi ironici per tutti: si gioca per ridere e scoprirsi, non per il punteggio.' },
];

export interface Duration {
  nome: string;
  durata: string;
  round: string;
}

export const DURATIONS: Duration[] = [
  { nome: 'Assaggio', durata: '~15 min', round: '3 round' },
  { nome: 'Classica', durata: '~30 min', round: '5 round' },
  { nome: 'Maratona', durata: '~45 min', round: '7 round' },
];

export interface Award {
  emoji: string;
  title: string;
  sub: string;
}

export const AWARDS: Award[] = [
  { emoji: '🏆', title: 'Il Persuasore', sub: 'Ha spostato più voti' },
  { emoji: '🎤', title: 'Il Grande Oratore', sub: 'Il più convincente, votato dai pari' },
  { emoji: '🎯', title: "L'Oracolo", sub: 'Indovina come finiscono le difese' },
  { emoji: '👏', title: 'Beniamino del pubblico', sub: 'Più reazioni mentre difende' },
  { emoji: '🎏', title: 'La Banderuola', sub: 'Cambia idea di continuo' },
  { emoji: '🪨', title: 'Il Roccione', sub: 'Non molla mai' },
  { emoji: '🔮', title: 'In sintonia', sub: 'Sempre con la maggioranza' },
  { emoji: '🦓', title: 'Bastian Contrario', sub: 'Sempre in minoranza' },
];

export type PartyModeVisualId = 'flash' | 'infiltrato' | 'coppie' | 'assurdo';

export interface PartyModeInfo {
  id: PartyModeVisualId;
  name: string;
  tag: string;
  desc: string;
}

export const PARTY_MODES_INFO: PartyModeInfo[] = [
  {
    id: 'flash',
    name: 'Schierati Flash',
    tag: 'Voto & Confronto',
    desc: 'Voto istantaneo e difesa lampo: chi resta in minoranza paga pegno.',
  },
  {
    id: 'infiltrato',
    name: "L'Infiltrato",
    tag: 'Bluff & Accusa',
    desc: 'Tutti hanno la stessa domanda tranne uno: smaschera chi bluffa.',
  },
  {
    id: 'coppie',
    name: 'Coppie & Scintille',
    tag: 'Complicità / 18+',
    desc: 'Allineamento cieco, verità senza filtri e sfide ad alta tensione.',
  },
  {
    id: 'assurdo',
    name: 'Assurdo',
    tag: 'Caos & Gogna',
    desc: 'Punta il dito sugli amici o svela il prezzo della tua dignità.',
  },
];
