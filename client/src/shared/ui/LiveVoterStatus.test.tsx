// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LiveVoterStatus } from './LiveVoterStatus';

describe('LiveVoterStatus', () => {
  afterEach(() => cleanup());

  it('renders current voted count and total count correctly', () => {
    render(<LiveVoterStatus votedCount={3} totalCount={6} label="Hanno votato" />);
    expect(screen.getByText('Hanno votato')).toBeInTheDocument();
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
  });

  it('renders in confirmedMode with appropriate label', () => {
    render(<LiveVoterStatus votedCount={5} totalCount={5} confirmedMode />);
    expect(screen.getByText('Confermati')).toBeInTheDocument();
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
  });

  it('renders the correct number of orbs and marks voted ones', () => {
    const { container } = render(<LiveVoterStatus votedCount={2} totalCount={4} />);
    const orbs = container.querySelectorAll('span[title]');
    expect(orbs.length).toBe(4);
    expect(orbs[0]).toHaveAttribute('title', 'Scelta inviata');
    expect(orbs[1]).toHaveAttribute('title', 'Scelta inviata');
    expect(orbs[2]).toHaveAttribute('title', 'In attesa');
    expect(orbs[3]).toHaveAttribute('title', 'In attesa');
  });
});
