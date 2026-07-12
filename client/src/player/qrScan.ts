// Pure helpers for the camera QR join flow. The room QR encodes `<origin>/join?room=CODE`
// (see JoinQr), but we also tolerate a bare code or a legacy `?code=` param. Unit-tested.

/** Extract a room code from a scanned QR payload, trimmed + uppercased, or null. */
export function parseRoomFromQr(text: string | null | undefined): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  // URL form: <origin>/join?room=CODE (or legacy ?code=CODE).
  try {
    const url = new URL(raw);
    const room = url.searchParams.get('room') ?? url.searchParams.get('code');
    if (room && room.trim()) return room.trim().toUpperCase();
  } catch {
    /* not a URL — fall through to bare-code handling */
  }
  // Bare code: a short alphanumeric token (room codes are 4 chars, allow 3–8).
  const code = raw.toUpperCase();
  return /^[A-Z0-9]{3,8}$/.test(code) ? code : null;
}
