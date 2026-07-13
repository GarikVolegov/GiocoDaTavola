import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, API_TIMEOUT_MS } from './api';

// A hung server (e.g. dead DB behind the API) must surface as a catchable
// error in seconds — browsers have NO default fetch timeout, so without this
// helper the affected pages spin forever.
describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('abortisce la richiesta allo scadere del timeout', async () => {
    const hang = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', hang);
    const pending = fetchWithTimeout('/x', {}, 5000);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(5001);
    await rejection;
  });

  it('sotto il timeout risolve normalmente con la Response', async () => {
    const response = new Response('{}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(fetchWithTimeout('/x', {}, 5000)).resolves.toBe(response);
  });

  it('passa method/headers/body a fetch e attacca un signal', async () => {
    const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', spy);
    await fetchWithTimeout('/y', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const [input, init] = spy.mock.calls[0];
    expect(input).toBe('/y');
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe('{}');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('il timeout di default è 10s', () => {
    expect(API_TIMEOUT_MS).toBe(10_000);
  });
});
