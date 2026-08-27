import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-push-route-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  const cards = await prisma.loyaltyCard.findMany({ where: { salonId: salon.id }, select: { id: true } });
  const cardIds = cards.map((c) => c.id);
  await prisma.pushSubscription.deleteMany({ where: { loyaltyCardId: { in: cardIds } } });
  await prisma.loyaltyCard.deleteMany({ where: { salonId: salon.id } });
  await prisma.customer.deleteMany({ where: { salonId: salon.id } });
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

test('GET /push/vapid-public-key returns the configured public key', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/push/vapid-public-key' });
  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.json().publicKey, 'string');
  await app.close();
});

test('POST /wallet/:serialNumber/push-subscribe saves a subscription for a real card', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Push Route Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);
    const customer = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { cookie },
      payload: { name: 'Jane' },
    });
    const serialNumber = customer.json().loyaltyCard.serialNumber;

    const response = await app.inject({
      method: 'POST',
      url: `/wallet/${serialNumber}/push-subscribe`,
      payload: { endpoint: 'https://example.com/ep-1', keys: { p256dh: 'p', auth: 'a' } },
    });
    assert.equal(response.statusCode, 201);

    const stored = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://example.com/ep-1' } });
    assert.ok(stored);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('POST /wallet/:serialNumber/push-subscribe returns 404 for an unknown serial', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({
    method: 'POST',
    url: '/wallet/LC-does-not-exist/push-subscribe',
    payload: { endpoint: 'https://example.com/ep-2', keys: { p256dh: 'p', auth: 'a' } },
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test('POST /api/reminders/send requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'POST', url: '/api/reminders/send' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('POST /api/reminders/send is rejected for a non-owner staff session', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Push Route Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const ownerCookie = String(signup.headers['set-cookie']);
    await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie: ownerCookie },
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });
    const login = await app.inject({
      method: 'POST',
      url: `/salons/${slug}/auth/login`,
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });
    const staffCookie = String(login.headers['set-cookie']);

    const response = await app.inject({ method: 'POST', url: '/api/reminders/send', headers: { cookie: staffCookie } });
    assert.equal(response.statusCode, 403);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('POST /api/reminders/send returns sent:0 when the salon has no reminderIntervalDays set', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Push Route Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const response = await app.inject({ method: 'POST', url: '/api/reminders/send', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { sent: 0 });
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});
