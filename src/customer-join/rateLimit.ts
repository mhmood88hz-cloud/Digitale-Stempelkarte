/**
 * Small in-memory fixed-window rate limiter, scoped to a single process -- fine here since this
 * is deployed as one instance (see Render config), and the only thing it protects is the public
 * self-lookup endpoint against scripted name/phone guessing, not a hard security boundary (see
 * findCustomerForSelfLookup for the actual access-control reasoning).
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = windows.get(key);
  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
