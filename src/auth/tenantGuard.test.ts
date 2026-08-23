import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { createSessionToken } from './session';
import { attachSession, requireAuth, requireSameSalon, SESSION_COOKIE_NAME } from './tenantGuard';

const SECRET = 'test-secret';
const SESSION = { staffUserId: 'staff-1', salonId: 'salon-1', role: 'owner' };

function buildTestApp() {
  const app = Fastify();
  app.addHook('preHandler', attachSession(SECRET));

  app.get('/me', { preHandler: requireAuth }, async (request) => request.session);

  app.get(
    '/salons/:salonId/secret',
    { preHandler: [requireAuth, requireSameSalon((request) => (request.params as { salonId: string }).salonId)] },
    async () => ({ ok: true }),
  );

  return app;
}

function cookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

test('requireAuth rejects requests without a session cookie', async () => {
  const app = buildTestApp();
  const response = await app.inject({ method: 'GET', url: '/me' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('requireAuth accepts requests with a valid session cookie', async () => {
  const app = buildTestApp();
  const token = createSessionToken(SESSION, SECRET);
  const response = await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookieHeader(token) } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), SESSION);
  await app.close();
});

test('requireSameSalon allows access when the session salon matches the route salon', async () => {
  const app = buildTestApp();
  const token = createSessionToken(SESSION, SECRET);
  const response = await app.inject({
    method: 'GET',
    url: '/salons/salon-1/secret',
    headers: { cookie: cookieHeader(token) },
  });
  assert.equal(response.statusCode, 200);
  await app.close();
});

test('requireSameSalon blocks access to a different salon (cross-tenant boundary)', async () => {
  const app = buildTestApp();
  const token = createSessionToken(SESSION, SECRET);
  const response = await app.inject({
    method: 'GET',
    url: '/salons/some-other-salon/secret',
    headers: { cookie: cookieHeader(token) },
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('requireSameSalon rejects unauthenticated requests before checking the salon', async () => {
  const app = buildTestApp();
  const response = await app.inject({ method: 'GET', url: '/salons/salon-1/secret' });
  assert.equal(response.statusCode, 401);
  await app.close();
});
