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

const googleWalletConfigured = Boolean(
  process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON,
);

test(
  'GET /wallet/:serialNumber/google-save-link redirects to a validly signed pay.google.com URL',
  { skip: !googleWalletConfigured && 'GOOGLE_WALLET_ISSUER_ID/GOOGLE_WALLET_SERVICE_ACCOUNT_JSON not configured' },
  async () => {
    const app = buildApp({ prisma, sessionSecret: 'test-secret' });
    const slug = `test-pwa-${Date.now()}`;
    try {
      const { serialNumber } = await setupSalonWithCard(app, slug);
      const response = await app.inject({ method: 'GET', url: `/wallet/${serialNumber}/google-save-link` });
      assert.equal(response.statusCode, 302);

      const location = response.headers.location as string;
      assert.match(location, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);

      const jwt = location.replace('https://pay.google.com/gp/v/save/', '');
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      assert.match(payload.iss, /\.iam\.gserviceaccount\.com$/);
      assert.equal(payload.payload.loyaltyObjects.length, 1);
      assert.equal(payload.payload.loyaltyObjects[0].barcode.value, serialNumber);
    } finally {
      await cleanupSalon(slug);
      await app.close();
    }
  },
);

test('GET /wallet/:serialNumber/google-save-link returns 404 for an unknown serial', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/wallet/LC-does-not-exist/google-save-link' });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test('GET /wallet/sw.js serves the service worker script', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/wallet/sw.js' });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /addEventListener\('fetch'/);
  await app.close();
});
