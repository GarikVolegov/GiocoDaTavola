// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AudioGate } from './AudioGate';

afterEach(cleanup);

describe('AudioGate', () => {
  it('prompts the host to tap to enable audio', () => {
    render(<AudioGate onActivate={() => {}} />);
    expect(screen.getByRole('button', { name: /attiva.*audio/i })).toBeInTheDocument();
  });

  it('activates on click', () => {
    const onActivate = vi.fn();
    render(<AudioGate onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: /attiva.*audio/i }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('activates on Enter/Space for keyboard users', () => {
    const onActivate = vi.fn();
    render(<AudioGate onActivate={onActivate} />);
    const gate = screen.getByRole('button', { name: /attiva.*audio/i });
    fireEvent.keyDown(gate, { key: 'Enter' });
    fireEvent.keyDown(gate, { key: ' ' });
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
