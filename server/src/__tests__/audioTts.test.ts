import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { getOrGenerateTts } from '../audioTts';

describe('audioTts server module', () => {
  it('rifiuta stringhe vuote', async () => {
    await expect(getOrGenerateTts('')).rejects.toThrow('Empty text');
    await expect(getOrGenerateTts('   ')).rejects.toThrow('Empty text');
  });

  it('genera e memorizza nella cache un file MP3 per un testo', async () => {
    const text = 'Benvenuti a Schierati. Test di voce neurale.';
    const filePath = await getOrGenerateTts(text);

    expect(fs.existsSync(filePath)).toBe(true);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(1024); // MP3 reale con dati audio

    // La seconda chiamata deve riusare il file in cache (stesso path)
    const cachedPath = await getOrGenerateTts(text);
    expect(cachedPath).toBe(filePath);
  }, 15000);
});
