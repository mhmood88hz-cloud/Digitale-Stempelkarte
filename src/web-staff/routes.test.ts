import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

test('GET /staff/scan requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/staff/scan' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /staff/scan serves the scan dashboard HTML once authenticated', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = `test-webstaff-${Date.now()}`;
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Web Staff Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const response = await app.inject({ method: 'GET', url: '/staff/scan', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] as string, /text\/html/);
    assert.match(response.body, /serial-input/);
    assert.match(response.body, /stamp-button/);
    assert.match(response.body, /new-customer-button/);
    assert.match(response.body, /\/staff\/jsqr\.js/);
  } finally {
    const salon = await prisma.salon.findUnique({ where: { slug } });
    if (salon) {
      await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
      await prisma.salon.delete({ where: { id: salon.id } });
    }
    await app.close();
  }
});

test('GET /staff/jsqr.js serves the QR-decoding library (no auth needed)', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/staff/jsqr.js' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] as string, /javascript/);
  assert.match(response.body, /jsQR/);
  await app.close();
});
