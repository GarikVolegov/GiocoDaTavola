import { describe, it, expect } from 'vitest';
import { computeRealWorldArchetype, type PlayerVoteStats } from './archetypes';

describe('computeRealWorldArchetype', () => {
  it('identifies Catalizzatore when persuasion is high', () => {
    const s: PlayerVoteStats = {
      rounds: 3,
      changedCount: 1,
      majorityCount: 2,
      minorityCount: 1,
      persuasion: 3,
      defendedCount: 2,
    };
    const arch = computeRealWorldArchetype(s);
    expect(arch.id).toBe('catalizzatore');
    expect(arch.title).toContain('Catalizzatore');
    expect(arch.insegnamentoReale).toBeDefined();
  });

  it('identifies Equilibrista when changedCount rate is high', () => {
    const s: PlayerVoteStats = {
      rounds: 4,
      changedCount: 3,
      majorityCount: 2,
      minorityCount: 2,
      persuasion: 0,
      defendedCount: 0,
    };
    const arch = computeRealWorldArchetype(s);
    expect(arch.id).toBe('equilibrista');
  });

  it('identifies Roccia when player never changes mind', () => {
    const s: PlayerVoteStats = {
      rounds: 3,
      changedCount: 0,
      majorityCount: 2,
      minorityCount: 1,
      persuasion: 0,
      defendedCount: 1,
    };
    const arch = computeRealWorldArchetype(s);
    expect(arch.id).toBe('roccia');
  });

  it('identifies Dissidente when often in minority', () => {
    const s: PlayerVoteStats = {
      rounds: 4,
      changedCount: 1,
      majorityCount: 1,
      minorityCount: 3,
      persuasion: 0,
      defendedCount: 0,
    };
    const arch = computeRealWorldArchetype(s);
    expect(arch.id).toBe('dissidente');
  });

  it('defaults to Pragmatico when stats are balanced or rounds are few', () => {
    const s: PlayerVoteStats = {
      rounds: 1,
      changedCount: 0,
      majorityCount: 1,
      minorityCount: 0,
      persuasion: 0,
      defendedCount: 0,
    };
    const arch = computeRealWorldArchetype(s);
    expect(arch.id).toBe('pragmatico');
  });
});
