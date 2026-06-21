import { describe, it, expect, beforeEach } from 'vitest';
import { verifyClerkToken } from '../clerk';

describe('verifyClerkToken', () => {
  beforeEach(() => { delete process.env.CLERK_SECRET_KEY; });

  it('returns null when no secret key is configured', async () => {
    expect(await verifyClerkToken('whatever')).toBeNull();
  });

  it('returns null for an empty/undefined token', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    expect(await verifyClerkToken('')).toBeNull();
    expect(await verifyClerkToken(undefined)).toBeNull();
  });
});
