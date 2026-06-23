// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MuteButton } from './MuteButton';
import { isMuted, setMuted } from './audio/engine';

beforeEach(() => setMuted(false));
afterEach(cleanup);

describe('MuteButton', () => {
  it('starts from the engine state — unmuted shows the speaker control', () => {
    render(<MuteButton />);
    expect(screen.getByRole('button', { name: 'Silenzia audio' })).toBeInTheDocument();
  });

  it('toggles the audio engine and its own label on click', () => {
    render(<MuteButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(isMuted()).toBe(true);
    expect(screen.getByRole('button', { name: 'Riattiva audio' })).toBeInTheDocument();
  });
});
