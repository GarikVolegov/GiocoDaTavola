import { describe, it, expect } from 'vitest';
import { generateBotDefense, type Completer } from '../aiDefense';
import type { Dilemma } from '../deck';

const DILEMMA: Dilemma = {
  id: 'd1',
  text: 'Rischiare o restare al sicuro?',
  optionA: 'Rischio tutto',
  optionB: 'Resto al sicuro',
  register: 'vita',
};

describe('generateBotDefense (Fase C)', () => {
  it('returns null when the completer yields null (AI disabled / no endpoint)', async () => {
    const complete: Completer = async () => null;
    expect(await generateBotDefense('roccione', DILEMMA, 'A', { complete })).toBeNull();
  });

  it('passes the chosen option in the prompt and returns the trimmed text', async () => {
    let seenUser = '';
    const complete: Completer = async ({ user }) => {
      seenUser = user;
      return '  Rischio tutto: chi non risica non rosica.  ';
    };
    const out = await generateBotDefense('roccione', DILEMMA, 'A', { complete });
    expect(out).toBe('Rischio tutto: chi non risica non rosica.');
    expect(seenUser).toContain('Rischio tutto'); // option A text, not B
  });

  it('returns null when the completer returns empty/whitespace', async () => {
    const complete: Completer = async () => '   ';
    expect(await generateBotDefense('indeciso', DILEMMA, 'B', { complete })).toBeNull();
  });

  it('returns null when the completer throws', async () => {
    const complete: Completer = async () => {
      throw new Error('endpoint unreachable');
    };
    expect(await generateBotDefense('gregge', DILEMMA, 'A', { complete })).toBeNull();
  });
});
