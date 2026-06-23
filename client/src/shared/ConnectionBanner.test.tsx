// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// A fake shared socket the test can drive: the component subscribes via `.on`,
// the test pushes connect/disconnect via `serverEmit`.
const { fakeSocket, serverEmit } = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  const socket = {
    connected: false,
    on(event: string, h: () => void) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(h);
      return socket;
    },
    off(event: string, h: () => void) {
      handlers.get(event)?.delete(h);
      return socket;
    },
  };
  return { fakeSocket: socket, serverEmit: (event: string) => handlers.get(event)?.forEach((h) => h()) };
});

vi.mock('./socket', () => ({ getSocket: () => fakeSocket }));

import ConnectionBanner from './ConnectionBanner';

describe('ConnectionBanner', () => {
  afterEach(() => cleanup());

  it('stays hidden before the first successful connect', () => {
    render(<ConnectionBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('appears only after a real drop (connect → disconnect) and hides on reconnect', () => {
    render(<ConnectionBanner />);
    act(() => serverEmit('connect'));
    expect(screen.queryByRole('status')).toBeNull(); // connected: no banner
    act(() => serverEmit('disconnect'));
    expect(screen.getByText(/riconnessione/i)).toBeInTheDocument();
    act(() => serverEmit('connect'));
    expect(screen.queryByRole('status')).toBeNull(); // reconnected: banner gone
  });
});
