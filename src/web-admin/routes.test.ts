import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

test('GET /admin requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/admin' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /admin serves the admin dashboard HTML once authenticated', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = `test-webadmin-${Date.now()}`;
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Web Admin Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const response = await app.inject({ method: 'GET', url: '/admin', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] as string, /text\/html/);
    assert.match(response.body, /save-settings/);
    assert.match(response.body, /add-staff/);
  } finally {
    const salon = await prisma.salon.findUnique({ where: { slug } });
    if (salon) {
      await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
      await prisma.salon.delete({ where: { id: salon.id } });
    }
    await app.close();
  }
});
