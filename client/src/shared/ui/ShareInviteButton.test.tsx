// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ShareInviteButton } from './ShareInviteButton';

describe('ShareInviteButton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // @ts-expect-error - test-only cleanup of a property we defined per-test
    delete navigator.share;
    // @ts-expect-error - test-only cleanup of a property we defined per-test
    delete navigator.clipboard;
  });

  it('calls navigator.share with the room join link when available', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Schierati',
      text: 'Unisciti alla mia partita su Schierati!',
      url: `${window.location.origin}/join?room=ABCD`,
    });
  });

  it('falls back to clipboard and shows a transient confirmation when share is unavailable', async () => {
    vi.useFakeTimers();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(writeTextSpy).toHaveBeenCalledTimes(1));
    // With fake timers, we must advance to flush microtasks and allow React state updates
    await vi.advanceTimersByTimeAsync(0);

    expect(writeTextSpy).toHaveBeenCalledWith(
      `Unisciti alla mia partita su Schierati!\n${window.location.origin}/join?room=ABCD`,
    );
    expect(screen.getByText('✓ Link copiato')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.queryByText('✓ Link copiato')).not.toBeInTheDocument();
  });

  it('falls back to a plain selectable link when neither share nor clipboard exist', async () => {
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));

    expect(
      await screen.findByText(`${window.location.origin}/join?room=ABCD`),
    ).toBeInTheDocument();
  });

  it('does nothing when the user dismisses the native share sheet', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const shareSpy = vi.fn().mockRejectedValue(abortError);
    const writeTextSpy = vi.fn();
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    expect(writeTextSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('✓ Link copiato')).not.toBeInTheDocument();
  });
});
