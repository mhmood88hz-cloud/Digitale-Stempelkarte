import type { FastifyReply, FastifyRequest } from 'fastify';
import { SUPERADMIN_COOKIE_NAME, verifySuperadminToken } from './session';

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

/** preHandler that rejects with 401 unless a valid superadmin session cookie is present. Fully
 * independent of staff/owner sessions (src/auth) -- salon staff can never satisfy this. */
export function requireSuperadmin(secret: string) {
  return async function requireSuperadminHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = parseCookie(request.headers.cookie, SUPERADMIN_COOKIE_NAME);
    if (!token || !verifySuperadminToken(token, secret)) {
      await reply.code(401).send({ error: 'unauthenticated' });
    }
  };
}
