import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-join-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.loyaltyCard.deleteMany({ where: { salonId: salon.id } });
  await prisma.customer.deleteMany({ where: { salonId: salon.id } });
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

async function setupSalon(app: ReturnType<typeof buildApp>, slug: string): Promise<void> {
  await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { salonName: 'Join Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
  });
}

test('GET /salons/:slug/join serves the form for a real salon (no auth needed)', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await setupSalon(app, slug);
    const response = await app.inject({ method: 'GET', url: `/salons/${slug}/join` });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /join-form/);
    assert.match(response.body, new RegExp(`/salons/${slug}/join`));
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /salons/:slug/join returns 404 for an unknown salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/salons/does-not-exist/join' });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test('POST /salons/:slug/join creates a customer + card with no authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await setupSalon(app, slug);
    const response = await app.inject({
      method: 'POST',
      url: `/salons/${slug}/join`,
      payload: { name: 'Selbst Registriert', phone: '0123456789' },
    });
    assert.equal(response.statusCode, 201);
    const serialNumber = response.json().serialNumber;
    assert.match(serialNumber, /^LC-/);

    const walletPage = await app.inject({ method: 'GET', url: `/wallet/${serialNumber}` });
    assert.equal(walletPage.statusCode, 200);
    assert.match(walletPage.body, /0 \/ 10 Stempel/);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('POST /salons/:slug/join requires a name', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await setupSalon(app, slug);
    const response = await app.inject({ method: 'POST', url: `/salons/${slug}/join`, payload: {} });
    assert.equal(response.statusCode, 400);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('POST /salons/:slug/join returns 404 for an unknown salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'POST', url: '/salons/does-not-exist/join', payload: { name: 'X' } });
  assert.equal(response.statusCode, 404);
  await app.close();
});
