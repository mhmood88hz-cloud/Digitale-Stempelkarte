import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.loyaltyCard.deleteMany({ where: { salonId: salon.id } });
  await prisma.customer.deleteMany({ where: { salonId: salon.id } });
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

async function setupSalonWithCard(
  app: ReturnType<typeof buildApp>,
  slug: string,
): Promise<{ cookie: string; serialNumber: string }> {
  const signup = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { salonName: 'PWA Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
  });
  const cookie = String(signup.headers['set-cookie']);
  const customer = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: { cookie },
    payload: { name: 'Jane Doe' },
  });
  return { cookie, serialNumber: customer.json().loyaltyCard.serialNumber };
}

test('GET /wallet/:serialNumber shows the card (public, no auth needed)', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = `test-pwa-${Date.now()}`;
  try {
    const { serialNumber } = await setupSalonWithCard(app, slug);
    const response = await app.inject({ method: 'GET', url: `/wallet/${serialNumber}` });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /PWA Test Salon/);
    assert.match(response.body, /0 \/ 10 Stempel/);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /wallet/:serialNumber returns 404 for an unknown serial', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/wallet/LC-does-not-exist' });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test('GET /wallet/:serialNumber/manifest.webmanifest returns a valid manifest', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = `test-pwa-${Date.now()}`;
  try {
    const { serialNumber } = await setupSalonWithCard(app, slug);
    const response = await app.inject({ method: 'GET', url: `/wallet/${serialNumber}/manifest.webmanifest` });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().start_url, `/wallet/${serialNumber}`);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /wallet/sw.js serves the service worker script', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/wallet/sw.js' });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /addEventListener\('fetch'/);
  await app.close();
});
