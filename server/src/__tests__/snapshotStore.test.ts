import { describe, it, expect } from 'vitest';
import { persistSnapshot, loadAllSnapshots, deleteSnapshot } from '../snapshotStore';

// With no DATABASE_URL the pool is null: every function must no-op without throwing
// (the game runs DB-less). This mirrors persistence.test.ts.
describe('snapshotStore (DB disabled)', () => {
  it('persist/delete resolve to no-op and load returns empty', async () => {
    await expect(persistSnapshot('ABCD', '{"code":"ABCD"}')).resolves.toBeUndefined();
    await expect(deleteSnapshot('ABCD')).resolves.toBeUndefined();
    await expect(loadAllSnapshots()).resolves.toEqual([]);
  });
});
