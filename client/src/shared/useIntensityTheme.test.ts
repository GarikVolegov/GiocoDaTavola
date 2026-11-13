import { describe, expect, it } from 'vitest';
import { resolveIntensityLevel } from './useIntensityTheme';

describe('resolveIntensityLevel', () => {
  it('defaults to medium when no intensity signals are present', () => {
    expect(resolveIntensityLevel({})).toBe('medium');
    expect(resolveIntensityLevel({ mood: 'mista', complessita: 'alto' })).toBe('medium');
  });

  it('returns light for leggera mood, sorbetto complexity, or flash party mode', () => {
    expect(resolveIntensityLevel({ mood: 'leggera' })).toBe('light');
    expect(resolveIntensityLevel({ complessita: 'sorbetto' })).toBe('light');
    expect(resolveIntensityLevel({ partyMode: 'flash' })).toBe('light');
  });

  it('returns intense for profonda mood, max/power complexity, or high-tension phases', () => {
    expect(resolveIntensityLevel({ mood: 'profonda' })).toBe('intense');
    expect(resolveIntensityLevel({ complessita: 'max' })).toBe('intense');
    expect(resolveIntensityLevel({ complessita: 'power' })).toBe('intense');
    expect(resolveIntensityLevel({ phase: 'DEFENSE' })).toBe('intense');
    expect(resolveIntensityLevel({ phase: 'VOTE_2' })).toBe('intense');
  });

  it('returns chaos for piccante intensity, assurdo mode, or alto caos', () => {
    expect(resolveIntensityLevel({ partyIntensity: 'piccante' })).toBe('chaos');
    expect(resolveIntensityLevel({ partyMode: 'assurdo' })).toBe('chaos');
    expect(resolveIntensityLevel({ caos: 'alto' })).toBe('chaos');
  });

  it('prioritizes chaos over intense and intense over light', () => {
    expect(resolveIntensityLevel({ mood: 'leggera', caos: 'alto' })).toBe('chaos');
    expect(resolveIntensityLevel({ mood: 'leggera', complessita: 'power' })).toBe('intense');
  });
});
