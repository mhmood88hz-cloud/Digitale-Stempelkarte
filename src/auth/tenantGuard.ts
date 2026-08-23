import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySessionToken, type SessionPayload } from './session';

export const SESSION_COOKIE_NAME = 'stampcard_session';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionPayload;
  }
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) return decodeURIComponent(part.slice(separatorIndex + 1).trim());
  }
  return null;
}

/**
 * preHandler that reads the session cookie (if present) and, when it verifies, attaches
 * `request.session`. Does NOT reject requests without a session -- use `requireAuth` for that.
 * Kept separate so read-only/public routes can still opt into knowing "who's asking" without
 * being forced to require auth.
 */
export function attachSession(secret: string) {
  return async function attachSessionHook(request: FastifyRequest): Promise<void> {
    const token = parseCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) return;
    const payload = verifySessionToken(token, secret);
    if (payload) request.session = payload;
  };
}

/** preHandler that rejects the request with 401 unless a valid session was attached. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session) {
    await reply.code(401).send({ error: 'unauthenticated' });
  }
}

/**
 * preHandler factory enforcing the core multi-tenant boundary: the authenticated staff user's
 * salon must match the salon the request is targeting (e.g. from a route param or a loaded
 * resource). Must run after `requireAuth` (or after `attachSession`, and it 401s itself if no
 * session is present).
 */
export function requireSameSalon(resolveSalonId: (request: FastifyRequest) => string) {
  return async function requireSameSalonHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.session) {
      await reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    const targetSalonId = resolveSalonId(request);
    if (targetSalonId !== request.session.salonId) {
      await reply.code(403).send({ error: 'forbidden' });
    }
  };
}
