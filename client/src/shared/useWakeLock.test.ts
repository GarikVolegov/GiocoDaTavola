// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

describe('useWakeLock', () => {
  let releaseMock: ReturnType<typeof vi.fn>;
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    releaseMock = vi.fn().mockResolvedValue(undefined);
    requestMock = vi.fn().mockResolvedValue({
      release: releaseMock,
      onrelease: null,
    });

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('richiede screen lock quando active è true', async () => {
    renderHook(() => useWakeLock(true));
    expect(requestMock).toHaveBeenCalledWith('screen');
  });

  it('rilascia il lock quando active passa a false', async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });
    expect(requestMock).toHaveBeenCalledWith('screen');

    // Wait for promise resolution
    await Promise.resolve();

    rerender({ active: false });
    expect(releaseMock).toHaveBeenCalled();
  });

  it('non fa nulla se active è false inizialmente', () => {
    renderHook(() => useWakeLock(false));
    expect(requestMock).not.toHaveBeenCalled();
  });
});
