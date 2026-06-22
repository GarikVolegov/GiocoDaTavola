// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { VoteOption } from './VoteOption';

describe('VoteOption', () => {
  afterEach(() => cleanup());

  it('renders a button whose accessible name includes the label', () => {
    render(<VoteOption faction="a" letter="A" label="Mare" onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: /Mare/ });
    expect(btn).toBeInTheDocument();
    // The big letter is decorative-ish but still part of the visible content.
    expect(btn).toHaveTextContent('A');
  });

  it('reflects the selected state via aria-pressed', () => {
    const { rerender } = render(
      <VoteOption faction="b" label="Montagna" selected={false} onClick={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<VoteOption faction="b" label="Montagna" selected onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders an optional hint and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <VoteOption faction="accent" label="REGGE" hint="La maggioranza tiene" onClick={onClick} />,
    );
    expect(screen.getByText('La maggioranza tiene')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /REGGE/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
