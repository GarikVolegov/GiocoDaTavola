import { useEffect } from 'react';
import type { Caos, Complessita, Mood, PartyIntensity, PartyMode } from './events';

export type IntensityLevel = 'light' | 'medium' | 'intense' | 'chaos';

export interface IntensityInput {
  mood?: Mood | null;
  complessita?: Complessita | null;
  caos?: Caos | null;
  partyMode?: PartyMode | null;
  partyIntensity?: PartyIntensity | 'profondo' | null;
  phase?: string | null;
}

/**
 * Resolves the active typographic intensity level from the room's seriousness,
 * party mode, and current dilemma complexity so display fonts shift dynamically.
 */
export function resolveIntensityLevel(input: IntensityInput): IntensityLevel {
  const { mood, complessita, caos, partyMode, partyIntensity, phase } = input;

  if (partyIntensity === 'piccante' || partyMode === 'assurdo' || caos === 'alto') {
    return 'chaos';
  }
  if (
    partyIntensity === 'profondo' ||
    complessita === 'max' ||
    complessita === 'power' ||
    mood === 'profonda' ||
    phase === 'DEFENSE' ||
    phase === 'VOTE_2'
  ) {
    return 'intense';
  }
  if (
    complessita === 'sorbetto' ||
    partyMode === 'flash' ||
    partyMode === 'preferiresti' ||
    partyMode === 'bufala' ||
    partyMode === 'stima' ||
    mood === 'leggera'
  ) {
    return 'light';
  }
  return 'medium';
}

/**
 * Syncs `data-intensity` on `document.documentElement` with the active game state,
 * resetting to `'medium'` on unmount.
 */
export function useIntensityTheme(input: IntensityInput): IntensityLevel {
  const level = resolveIntensityLevel(input);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.intensity = level;
    return () => {
      document.documentElement.dataset.intensity = 'medium';
    };
  }, [level]);

  return level;
}
