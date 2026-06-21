// Static marketing content for the landing page. Repeated data lives here so the
// section components stay declarative. Shared copy is reused from events.ts where
// it already exists (HOW_TO_PLAY, OBJECTIVE).

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  { icon: '🗳️', title: '60 dilemmi, mai gli stessi', body: 'Scelte di vita e di business: scomode, divertenti, da litigarci (per gioco).' },
  { icon: '🎯', title: 'Vince chi convince', body: 'Non conta aver ragione: conta far cambiare idea agli altri… e restare pronti a cambiarla tu.' },
  { icon: '🤖', title: 'Anche in pochi', body: 'Pochi amici? Aggiungi dei bot con personalità e giocate lo stesso.' },
  { icon: '🎉', title: 'Nessuno perde', body: 'A fine serata premi simpatici per tutti. Si gioca per ridere, non per vincere.' },
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
