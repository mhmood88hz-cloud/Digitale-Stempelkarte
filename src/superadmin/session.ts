import { createHmac, timingSafeEqual } from 'node:crypto';

export const SUPERADMIN_COOKIE_NAME = 'stampcard_superadmin_session';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h, same as staff sessions
// Included in the signed payload so a staff session token (signed with the same secret, see
// auth/session.ts) can never be replayed here even if someone forged one containing this marker
// by hand -- the marker plus HMAC together are what a forger would need, not the marker alone.
const MARKER = 'superadmin';

interface SignedPayload {
  marker: typeof MARKER;
  exp: number;
}

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function createSuperadminToken(secret: string, ttlMs = TTL_MS): string {
  const payload: SignedPayload = { marker: MARKER, exp: Date.now() + ttlMs };
  const payloadB64 = base64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifySuperadminToken(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expected = Buffer.from(sign(payloadB64, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SignedPayload;
    return parsed.marker === MARKER && typeof parsed.exp === 'number' && Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

export function buildSuperadminSetCookie(token: string, secure = false): string {
  const parts = [`${SUPERADMIN_COOKIE_NAME}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${TTL_MS / 1000}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildSuperadminClearCookie(secure = false): string {
  const parts = [`${SUPERADMIN_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
