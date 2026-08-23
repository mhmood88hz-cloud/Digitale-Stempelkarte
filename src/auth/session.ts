import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionPayload {
  staffUserId: string;
  salonId: string;
  role: string;
}

interface SignedSession extends SessionPayload {
  exp: number; // unix ms timestamp
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function createSessionToken(payload: SessionPayload, secret: string, ttlMs = DEFAULT_TTL_MS): string {
  const signed: SignedSession = { ...payload, exp: Date.now() + ttlMs };
  const payloadB64 = base64url(JSON.stringify(signed));
  const signature = sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/** Returns the session payload if the token is well-formed, correctly signed, and not expired; otherwise null. */
export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let parsed: SignedSession;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
  const { staffUserId, salonId, role } = parsed;
  if (!staffUserId || !salonId || !role) return null;

  return { staffUserId, salonId, role };
}
