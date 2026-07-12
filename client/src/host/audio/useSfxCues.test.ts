// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GameStatePayload } from '../../shared/events';

const { fakeSocket, serverEmit } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  const socket = {
    on(event: string, h: (p: unknown) => void) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(h);
      return socket;
    },
    off(event: string, h: (p: unknown) => void) {
      handlers.get(event)?.delete(h);
      return socket;
    },
  };
  return {
    fakeSocket: socket,
    serverEmit: (event: string) => handlers.get(event)?.forEach((h) => h(undefined)),
  };
});
vi.mock('../../shared/socket', () => ({ getSocket: () => fakeSocket }));

const playSfx = vi.fn();
vi.mock('./sfx', () => ({ play: (name: string) => playSfx(name) }));
vi.mock('./engine', () => ({ unlockAudio: () => {} }));

import { useSfxCues } from './useSfxCues';

function game(over: Partial<GameStatePayload>): GameStatePayload {
  return {
    phase: 'LOBBY',
    phaseExpiresAt: null,
    swing: null,
    duoRoundResult: null,
    defense: null,
    ...over,
  } as GameStatePayload;
}

describe('useSfxCues — discard suppression', () => {
  beforeEach(() => {
    playSfx.mockClear();
  });

  function activate() {
    // The hook only makes sound once a user gesture has unlocked audio.
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
  }

  it('plays only "discard", never a redundant "reveal", when a VOTE_1 discard re-reveals a DIFFERENT phase', () => {
    const { rerender } = renderHook(
      ({ g }) => useSfxCues({ enabled: true, game: g }),
      { initialProps: { g: game({ phase: 'VOTE_1' }) } },
    );
    activate();
    // The leader discards from an open VOTE_1: the server emits
    // room:dilemmaSkipped, THEN a game:state that moves the phase to
    // DILEMMA_REVEAL (a real transition — sfxForTransition would normally
    // fire 'reveal' here too).
    act(() => serverEmit('room:dilemmaSkipped'));
    act(() => rerender({ g: game({ phase: 'DILEMMA_REVEAL' }) }));

    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('discard');
  });

  it('still plays "reveal" normally on DILEMMA_REVEAL when there was no discard', () => {
    const { rerender } = renderHook(
      ({ g }) => useSfxCues({ enabled: true, game: g }),
      { initialProps: { g: game({ phase: 'VOTE_2' }) } },
    );
    activate();
    act(() => rerender({ g: game({ phase: 'DILEMMA_REVEAL' }) }));

    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('reveal');
  });

  it('does not suppress a LATER, unrelated transition after the discard has been consumed', () => {
    const { rerender } = renderHook(
      ({ g }) => useSfxCues({ enabled: true, game: g }),
      { initialProps: { g: game({ phase: 'VOTE_1' }) } },
    );
    activate();
    act(() => serverEmit('room:dilemmaSkipped'));
    act(() => rerender({ g: game({ phase: 'DILEMMA_REVEAL' }) })); // consumes the suppression
    playSfx.mockClear();
    act(() => rerender({ g: game({ phase: 'VOTE_1' }) }));
    act(() => rerender({ g: game({ phase: 'SPLIT_REVEAL' }) }));

    expect(playSfx).toHaveBeenCalledWith('reveal'); // the normal SPLIT_REVEAL sting
  });
});
