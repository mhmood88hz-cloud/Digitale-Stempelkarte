import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-billing-route-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

test('POST /api/billing/checkout requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({
    method: 'POST',
    url: '/api/billing/checkout',
    payload: { successUrl: 'https://example.com/ok', cancelUrl: 'https://example.com/cancel' },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('POST /api/billing/checkout is rejected for a non-owner staff session', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Billing Route Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: staffCookie },
      payload: { successUrl: 'https://example.com/ok', cancelUrl: 'https://example.com/cancel' },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

const billingFullyConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STARTER && process.env.STRIPE_PRICE_STANDARD,
);

test(
  'POST /api/billing/checkout creates a real Stripe Checkout Session (starter price, <=100 customers)',
  { skip: !billingFullyConfigured && 'STRIPE_SECRET_KEY/STRIPE_PRICE_STARTER/STRIPE_PRICE_STANDARD not fully configured' },
  async () => {
    const app = buildApp({ prisma, sessionSecret: 'test-secret' });
    const slug = uniqueSlug();
    try {
      const signup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { salonName: 'Billing Checkout Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
      });
      const cookie = String(signup.headers['set-cookie']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        headers: { cookie },
        payload: { successUrl: 'https://example.com/ok', cancelUrl: 'https://example.com/cancel' },
      });
      assert.equal(response.statusCode, 200);
      assert.match(response.json().checkoutUrl, /^https:\/\/checkout\.stripe\.com\//);
    } finally {
      await cleanupSalon(slug);
      await app.close();
    }
  },
);

test('POST /api/billing/webhook rejects a request with no Stripe-Signature header', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({
    method: 'POST',
    url: '/api/billing/webhook',
    payload: { type: 'checkout.session.completed' },
  });
  // Without STRIPE_SECRET_KEY configured this is 503; with it configured but no signature, 400.
  // Either way it must NOT process the event.
  assert.ok([400, 503].includes(response.statusCode));
  await app.close();
});
