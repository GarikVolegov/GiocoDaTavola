// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { leanFromSplit } from './BivioBackdrop';

afterEach(() => cleanup());

describe('leanFromSplit', () => {
  it('returns 50 (neutral) when there are no votes', () => {
    expect(leanFromSplit({ A: 0, B: 0 })).toBe(50);
  });
  it('returns 100 when every vote is on A', () => {
    expect(leanFromSplit({ A: 3, B: 0 })).toBe(100);
  });
  it('returns 0 when every vote is on B', () => {
    expect(leanFromSplit({ A: 0, B: 4 })).toBe(0);
  });
  it('returns the rounded A-percentage otherwise', () => {
    expect(leanFromSplit({ A: 1, B: 3 })).toBe(25);
    expect(leanFromSplit({ A: 1, B: 2 })).toBe(33);
  });
});
