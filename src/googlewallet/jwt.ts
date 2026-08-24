import { createSign } from 'node:crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Signs a JWT with RS256. Generic, not Google-specific -- the "save to wallet" payload shape
 * is the caller's responsibility (see saveLink.ts). Implemented directly on node:crypto (same
 * approach as src/auth/session.ts's HMAC signing) rather than pulling in a JWT library for one
 * signing call.
 */
export function signRS256Jwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}
