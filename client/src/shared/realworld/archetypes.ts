// Archetipi Decisionali del Mondo Reale per SCHIERATI: NEXUS.
// Trasforma le dinamiche di gioco e le statistiche di voto in chiavi di lettura
// psicologiche e lezioni applicabili alla vita vera e professionale.

export interface PlayerVoteStats {
  rounds: number;
  changedCount: number;
  majorityCount: number;
  minorityCount: number;
  persuasion: number;
  defendedCount: number;
  reactionsReceived?: number;
  correctPredictions?: number;
}

export interface RealWorldArchetype {
  id: string;
  title: string;
  emoji: string;
  motto: string;
  descrizione: string;
  insegnamentoReale: string;
}

export function computeRealWorldArchetype(s: PlayerVoteStats): RealWorldArchetype {
  const { rounds, changedCount, majorityCount, minorityCount, persuasion } = s;
  const rate = (n: number): number => (rounds > 0 ? n / rounds : 0);

  // 1. Grande capacità persuasiva: orienta il gruppo
  if (persuasion >= 2) {
    return {
      id: 'catalizzatore',
      title: 'Il Catalizzatore d’Impatto',
      emoji: '⚡',
      motto: '«Le parole giuste spostano le montagne.»',
      descrizione:
        'Hai un magnetismo naturale: le tue difese hanno convinto gli altri a cambiare prospettiva.',
      insegnamentoReale:
        'Nel mondo reale: la capacità di persuasione è una superpotenza etica. Usala per allineare le persone attorno a cause costruttive, non solo per vincere il confronto.',
    };
  }

  // 2. Flessibilità intellettuale e ascolto attivo
  if (rounds >= 2 && rate(changedCount) >= 0.5) {
    return {
      id: 'equilibrista',
      title: 'L’Equilibrista Strategico',
      emoji: '⚖️',
      motto: '«La coerenza cieca è la tomba dell’apprendimento.»',
      descrizione:
        'Non hai paura di riconsiderare la rotta quando ascolti un’argomentazione solida.',
      insegnamentoReale:
        'Nel mondo reale: la velocità di aggiornare i propri modelli mentali (mental agility) è il fattore #1 per navigare scenari incerti e decisioni complesse.',
    };
  }

  // 3. Ferma coerenza e visione incrollabile
  if (rounds >= 2 && changedCount === 0) {
    return {
      id: 'roccia',
      title: 'La Roccia dei Principi',
      emoji: '🛡️',
      motto: '«Radici profonde non temono il vento.»',
      descrizione:
        'Difendi le tue convinzioni con fermezza e non ti lasci scuotere dal rumore di fondo.',
      insegnamentoReale:
        'Nel mondo reale: l’integrità è una bussola rara. Ricorda però che il confine tra coerenza e ostinazione sta nella disponibilità a testare le proprie certezze.',
    };
  }

  // 4. Pensatore critico e controcorrente
  if (rounds >= 2 && rate(minorityCount) >= 0.5) {
    return {
      id: 'dissidente',
      title: 'Il Dissidente Lucido',
      emoji: '🦅',
      motto: '«La folla ha spesso torto; il valore sta dove nessuno guarda.»',
      descrizione:
        'Vedi angolazioni che agli altri sfuggono e non cerchi il consenso facile a costo della verità.',
      insegnamentoReale:
        'Nel mondo reale: i migliori innovatori e investitori sono contrarian che hanno ragione. Il tuo valore cresce quando spieghi la tua visione senza isolarti.',
    };
  }

  // 5. Sintonia e intelligenza relazionale
  if (rounds >= 2 && rate(majorityCount) >= 0.6) {
    return {
      id: 'sintonia',
      title: 'Il Lettore di Risonanze',
      emoji: '🔮',
      motto: '«Capire il battito del gruppo è metà della vittoria.»',
      descrizione:
        'Hai un intuito affinato per comprendere dove sta andando il gruppo e trovare convergenze.',
      insegnamentoReale:
        'Nel mondo reale: la comprensione del sentiment collettivo ti rende un leader naturale nei team. Assicurati di esprimere la tua voce autentica anche quando dissona.',
    };
  }

  // Default: Pragmatico
  return {
    id: 'pragmatico',
    title: 'Il Pragmatico Istintivo',
    emoji: '🧭',
    motto: '«Fatti, non parole; opzioni concrete, non teorie.»',
    descrizione:
      'Valuti i trade-off con concretezza, cercando l’equilibrio tra rischio e risultato.',
    insegnamentoReale:
      'Nel mondo reale: l’azione imperfetta batte sempre l’intenzione perfetta. Coltiva l’ascolto per arricchire la tua naturale lucidità operativa.',
  };
}
