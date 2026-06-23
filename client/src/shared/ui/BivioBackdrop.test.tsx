// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BivioBackdrop, leanFromSplit } from './BivioBackdrop';

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

describe('BivioBackdrop', () => {
  it('renders a decorative, aria-hidden layer', () => {
    render(<BivioBackdrop variant="host" />);
    const el = screen.getByTestId('bivio-backdrop');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses full intensity on host', () => {
    render(<BivioBackdrop variant="host" />);
    expect(screen.getByTestId('bivio-backdrop').style.getPropertyValue('--bivio-k')).toBe('1');
  });

  it('uses reduced intensity on player', () => {
    render(<BivioBackdrop variant="player" />);
    expect(screen.getByTestId('bivio-backdrop').style.getPropertyValue('--bivio-k')).toBe('0.4');
  });
});
