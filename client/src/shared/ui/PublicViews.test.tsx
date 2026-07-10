// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PodiumPanel } from './PublicViews';
import type { PodiumEntry } from '../events';

afterEach(cleanup);

const entry = (id: string, nickname: string, points: number, rank: number): PodiumEntry => ({
  player: { id, nickname },
  points,
  rank,
});

describe('PodiumPanel', () => {
  it('mostra i primi tre con medaglie e punti', () => {
    render(
      <PodiumPanel
        podium={[entry('a', 'Anna', 12, 1), entry('b', 'Bea', 9, 2), entry('c', 'Ciro', 7, 3)]}
      />,
    );
    expect(screen.getByText(/il podio della serata/i)).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText(/12 punti/i)).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('mette gli ex aequo sullo stesso gradino e salta il gradino successivo', () => {
    render(
      <PodiumPanel podium={[entry('a', 'Anna', 9, 1), entry('b', 'Bea', 9, 1), entry('c', 'Ciro', 5, 3)]} />,
    );
    expect(screen.getByText(/anna · bea/i)).toBeInTheDocument();
    expect(screen.queryByText('🥈')).toBeNull();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('elenca chi resta giù dal podio nella classifica completa', () => {
    render(
      <PodiumPanel
        podium={[entry('a', 'Anna', 12, 1), entry('b', 'Bea', 9, 2), entry('c', 'Ciro', 7, 3), entry('d', 'Dino', 3, 4)]}
      />,
    );
    expect(screen.getByText(/4°/)).toBeInTheDocument();
    expect(screen.getByText(/dino/i)).toBeInTheDocument();
  });

  it('evidenzia la propria riga con "(tu)" dato meId', () => {
    render(<PodiumPanel podium={[entry('a', 'Anna', 12, 1), entry('me', 'Gino', 9, 2)]} meId="me" />);
    expect(screen.getByText(/gino \(tu\)/i)).toBeInTheDocument();
  });

  it('non renderizza nulla senza classificati', () => {
    const { container } = render(<PodiumPanel podium={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
