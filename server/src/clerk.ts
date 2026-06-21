// Verify a Clerk session JWT server-side. Returns the user id (sub) or null.
// CLERK_SECRET_KEY is server-only. Networkless except for Clerk's JWKS fetch.
import { verifyToken } from '@clerk/backend';

export async function verifyClerkToken(token: string | undefined): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || !token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
