import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// With a dead DB (e.g. quota-exhausted Neon) the 15s snapshot interval used to
// retry and log a full stack every time — pure log spam. The breaker pauses
// persist attempts for a cooldown after a failure and logs once per burst.

const { query } = vi.hoisted(() => ({ query: vi.fn<() => Promise<unknown>>() }));

vi.mock('../db', () => ({
  getPool: () => ({ query }) as unknown as import('pg').Pool,
  dbEnabled: () => true,
  migrate: async () => {},
  __resetPoolForTests: () => {},
}));

import { persistSnapshot, __resetSnapshotBreakerForTests } from '../snapshotStore';

describe('persistSnapshot circuit breaker (DB che fallisce)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetSnapshotBreakerForTests();
    query.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logga il primo failure, poi tace e salta i tentativi', async () => {
    query.mockRejectedValue(new Error('exceeded the compute time quota'));
    await persistSnapshot('ABCD', '{}');
    await persistSnapshot('ABCD', '{}');
    await persistSnapshot('EFGH', '{}');
    expect(query).toHaveBeenCalledTimes(1); // i tentativi 2-3 sono saltati
    expect(errorSpy).toHaveBeenCalledTimes(1); // una sola riga di log
  });

  it('riprova dopo il cooldown', async () => {
    query.mockRejectedValue(new Error('exceeded the compute time quota'));
    await persistSnapshot('ABCD', '{}');
    expect(query).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60_000 + 1);
    await persistSnapshot('ABCD', '{}');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('failure concorrenti nello stesso burst loggano una sola riga', async () => {
    query.mockRejectedValue(new Error('exceeded the compute time quota'));
    // Entrambe partono col breaker chiuso (stesso tick del setInterval).
    await Promise.all([persistSnapshot('AAAA', '{}'), persistSnapshot('BBBB', '{}')]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('un successo non apre il breaker e non rejecta mai', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(persistSnapshot('ABCD', '{}')).resolves.toBeUndefined();
    await expect(persistSnapshot('ABCD', '{}')).resolves.toBeUndefined();
    await expect(persistSnapshot('ABCD', '{}')).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(3);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
