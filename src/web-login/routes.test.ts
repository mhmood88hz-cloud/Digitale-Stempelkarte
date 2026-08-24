import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

test('GET /salons/:slug/login serves a login form (no auth needed)', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/salons/demo-salon/login' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] as string, /text\/html/);
  assert.match(response.body, /login-form/);
  assert.match(response.body, /\/salons\/demo-salon\/auth\/login/);
  await app.close();
});

test('GET /salons/:slug/login escapes the slug to prevent HTML injection', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/salons/%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E/login' });
  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(response.body, /<script>alert\(1\)<\/script>/);
  await app.close();
});
