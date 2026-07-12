import { describe, it, expect } from 'vitest';
import {
  pickIronicTitle,
  WRONG_PREDICTION_TITLES,
  WRONG_SWING_BET_TITLES,
  WRONG_KNOW_TITLES,
} from './ironicTitles';

describe('pickIronicTitle', () => {
  it('picks the first title when rng returns 0', () => {
    expect(pickIronicTitle(WRONG_PREDICTION_TITLES, () => 0)).toBe(WRONG_PREDICTION_TITLES[0]);
  });

  it('picks the last title when rng returns just under 1', () => {
    expect(pickIronicTitle(WRONG_PREDICTION_TITLES, () => 0.999)).toBe(
      WRONG_PREDICTION_TITLES[WRONG_PREDICTION_TITLES.length - 1],
    );
  });

  it('each pool has multiple distinct, non-empty titles', () => {
    for (const pool of [WRONG_PREDICTION_TITLES, WRONG_SWING_BET_TITLES, WRONG_KNOW_TITLES]) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.every((t) => t.trim().length > 0)).toBe(true);
    }
  });
});
