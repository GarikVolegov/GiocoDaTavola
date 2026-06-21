// Per-player end-of-game "blind spot": one deterministic improvement tip derived
// from the player's accumulated vote stats (no AI). Sibling of awards.ts.

import type { PlayerStats } from './awards';

export type BlindSpotId =
  | 'volubile'
  | 'rigido'
  | 'conformista'
  | 'contrarian'
  | 'difese-deboli'
  | 'equilibrato'
  | 'esordiente';

export interface BlindSpot {
  id: BlindSpotId;
  title: string;
  advice: string;
}

/**
 * Map a player's accumulated stats to a single blind-spot tip. Rules are checked
 * in priority order — the first match wins. Behavioural rules need >= 3 rounds;
 * "rigido" needs >= 2; with < 2 rounds there's no readable pattern (esordiente).
 */
export function computeBlindSpot(s: PlayerStats): BlindSpot {
  const { rounds, changedCount, majorityCount, minorityCount, persuasion, defendedCount } = s;
  const rate = (n: number): number => (rounds > 0 ? n / rounds : 0);

  if (rounds >= 3 && rate(changedCount) >= 2 / 3) {
    return {
      id: 'volubile',
      title: 'Cambi idea spesso',
      advice:
        'Bello restare aperti, ma assicurati che a convincerti siano gli argomenti, non la maggioranza. Prova a difendere di più la tua prima scelta.',
    };
  }
  if (rounds >= 2 && changedCount === 0) {
    return {
      id: 'rigido',
      title: 'Non cambi mai idea',
      advice:
        'La prossima volta prova ad ascoltare il «perché» di chi la pensa diversamente e a lasciarti convincere almeno una volta.',
    };
  }
  if (rounds >= 3 && rate(majorityCount) >= 2 / 3) {
    return {
      id: 'conformista',
      title: 'Vai con il gruppo',
      advice:
        'Finisci quasi sempre con la maggioranza. Fidati di più del tuo istinto quando vai controcorrente: a volte la minoranza ha ragione.',
    };
  }
  if (rounds >= 3 && rate(minorityCount) >= 2 / 3) {
    return {
      id: 'contrarian',
      title: 'Spesso in minoranza',
      advice:
        'Avere idee proprie è un pregio, ma chiediti se a volte la maggioranza ha colto qualcosa che a te sfugge.',
    };
  }
  if (defendedCount >= 1 && persuasion <= 0) {
    return {
      id: 'difese-deboli',
      title: 'Difese poco incisive',
      advice:
        'Quando hai difeso, il gruppo non si è spostato verso di te. Prova ad argomentare con esempi concreti più che con principi.',
    };
  }
  if (rounds < 2) {
    return {
      id: 'esordiente',
      title: 'Poche giocate',
      advice: 'Hai giocato pochi round: difficile leggere un punto cieco. Buttati di più la prossima volta!',
    };
  }
  return {
    id: 'equilibrato',
    title: 'Bell\'equilibrio',
    advice: 'Buon equilibrio tra ascolto e convinzione: il prossimo passo è far cambiare idea agli altri con esempi concreti.',
  };
}
