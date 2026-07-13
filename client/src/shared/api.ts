// Shared fetch for the /api/me/* account endpoints.
export const API_TIMEOUT_MS = 10_000;

/** fetch with a hard timeout: a hung server (e.g. dead DB behind the API) must
 *  surface as a catchable error in seconds, never an infinite spinner —
 *  browsers have no default fetch timeout of their own. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
