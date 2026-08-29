import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
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

export function buildSetCookieHeader(token: string, options: { secure?: boolean; maxAgeSeconds?: number } = {}): string {
  const { secure = false, maxAgeSeconds = 12 * 60 * 60 } = options;
  const parts = [`${SESSION_COOKIE_NAME}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookieHeader(secure = false): string {
  const parts = [`${SESSION_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
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

/** preHandler that rejects with 401 (no session) or 403 (session present, but role != 'owner'). */
export async function requireOwner(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session) {
    await reply.code(401).send({ error: 'unauthenticated' });
    return;
  }
  if (request.session.role !== 'owner') {
    await reply.code(403).send({ error: 'forbidden' });
  }
}

/**
 * preHandler that blocks every staff/owner request for a salon the platform owner has paused
 * (Salon.isActive, toggled from /superadmin -- see src/superadmin). Runs on every request that
 * has a session, right after the session is attached, so a pause takes effect on the salon's
 * very next request instead of waiting for its 12h session to expire. `/auth/logout` is exempt
 * so staff can still clear their own cookie once paused.
 */
export function blockInactiveSalon(prisma: PrismaClient) {
  return async function blockInactiveSalonHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // /superadmin* routes check their own, separate cookie (src/superadmin) and must stay
    // reachable regardless of any salon's status -- otherwise a browser that happens to also be
    // carrying a paused salon's staff cookie (e.g. the same device used for both) would get
    // locked out of the very page meant to un-pause it.
    if (!request.session || request.url === '/auth/logout' || request.url.startsWith('/superadmin') || request.url.startsWith('/api/superadmin')) {
      return;
    }
    const salon = await prisma.salon.findUnique({ where: { id: request.session.salonId }, select: { isActive: true } });
    if (salon && !salon.isActive) {
      await reply.code(403).send({ error: 'salon_paused' });
    }
  };
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
