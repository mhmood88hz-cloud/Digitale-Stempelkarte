import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-loyalty-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  const cards = await prisma.loyaltyCard.findMany({ where: { salonId: salon.id }, select: { id: true } });
  const cardIds = cards.map((c) => c.id);
  await prisma.stampEvent.deleteMany({ where: { loyaltyCardId: { in: cardIds } } });
  await prisma.redemption.deleteMany({ where: { loyaltyCardId: { in: cardIds } } });
  await prisma.loyaltyCard.deleteMany({ where: { salonId: salon.id } });
  await prisma.customer.deleteMany({ where: { salonId: salon.id } });
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

async function signupSalon(
  app: ReturnType<typeof buildApp>,
  slug: string,
): Promise<{ cookie: string; salonId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { salonName: 'Loyalty Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
  });
  const cookie = String(response.headers['set-cookie']);
  return { cookie, salonId: response.json().salon.id };
}

async function createCustomer(app: ReturnType<typeof buildApp>, cookie: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: { cookie },
    payload: { name: 'Jane Doe' },
  });
  assert.equal(response.statusCode, 201);
  return response.json().loyaltyCard.serialNumber as string;
}

test('POST /api/customers requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'Jane Doe' } });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('stamping a card up to the threshold marks the reward ready, then redemption resets it', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const { cookie } = await signupSalon(app, slug);
    const serialNumber = await createCustomer(app, cookie);

    let last;
    for (let i = 0; i < 10; i++) {
      last = await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber } });
      assert.equal(last.statusCode, 200);
    }
    assert.equal(last!.json().stampCount, 10);
    assert.equal(last!.json().rewardReady, true);

    const tooEarly = await app.inject({
      method: 'POST',
      url: '/api/redemptions',
      headers: { cookie },
      payload: { serialNumber: 'LC-does-not-matter-here' },
    });
    assert.equal(tooEarly.statusCode, 404); // wrong serial, sanity check the 404 path too

    const redeemed = await app.inject({
      method: 'POST',
      url: '/api/redemptions',
      headers: { cookie },
      payload: { serialNumber },
    });
    assert.equal(redeemed.statusCode, 200);
    assert.equal(redeemed.json().stampCount, 0);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('redemption is rejected before the stamp threshold is reached', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const { cookie } = await signupSalon(app, slug);
    const serialNumber = await createCustomer(app, cookie);

    await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/redemptions',
      headers: { cookie },
      payload: { serialNumber },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, 'reward_not_ready');
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('a staff session from one salon cannot stamp a card belonging to another salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slugA = uniqueSlug();
  const slugB = uniqueSlug();
  try {
    const { cookie: cookieA } = await signupSalon(app, slugA);
    const serialNumber = await createCustomer(app, cookieA);

    const { cookie: cookieB } = await signupSalon(app, slugB);
    const response = await app.inject({
      method: 'POST',
      url: '/api/stamps',
      headers: { cookie: cookieB },
      payload: { serialNumber },
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await cleanupSalon(slugA);
    await cleanupSalon(slugB);
    await app.close();
  }
});

test('GET /api/customers requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/api/customers' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /api/customers lists this salon\'s customers with their card summary', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const { cookie } = await signupSalon(app, slug);
    const serialNumber = await createCustomer(app, cookie);
    await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber } });

    const response = await app.inject({ method: 'GET', url: '/api/customers', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    const list = response.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].serialNumber, serialNumber);
    assert.equal(list[0].stampCount, 1);
    assert.equal(list[0].hasPushSubscription, false);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('customers get sequential, per-salon customer numbers starting at 1', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const { cookie } = await signupSalon(app, slug);
    await createCustomer(app, cookie);
    await createCustomer(app, cookie);

    const response = await app.inject({ method: 'GET', url: '/api/customers', headers: { cookie } });
    const numbers = response.json().map((c: { customerNumber: number }) => c.customerNumber).sort();
    assert.deepEqual(numbers, [1, 2]);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/customers/search finds by name, phone, and customer number, but not on 1 character', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const { cookie } = await signupSalon(app, slug);
    await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { cookie },
      payload: { name: 'Anna Beispiel', phone: '0170 1234567' },
    });

    const byName = await app.inject({ method: 'GET', url: '/api/customers/search?q=Anna', headers: { cookie } });
    assert.equal(byName.statusCode, 200);
    assert.equal(byName.json().length, 1);
    assert.equal(byName.json()[0].name, 'Anna Beispiel');

    const byPhone = await app.inject({ method: 'GET', url: '/api/customers/search?q=1234567', headers: { cookie } });
    assert.equal(byPhone.json().length, 1);

    const byNumber = await app.inject({
      method: 'GET',
      url: '/api/customers/search?q=' + byName.json()[0].customerNumber,
      headers: { cookie },
    });
    assert.equal(byNumber.json().length, 1);

    const tooShort = await app.inject({ method: 'GET', url: '/api/customers/search?q=A', headers: { cookie } });
    assert.deepEqual(tooShort.json(), []);

    const noHit = await app.inject({ method: 'GET', url: '/api/customers/search?q=zzzzz', headers: { cookie } });
    assert.deepEqual(noHit.json(), []);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/customers/search requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/api/customers/search?q=ab' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /api/customers/search does not leak another salon\'s customers', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slugA = uniqueSlug();
  const slugB = uniqueSlug();
  try {
    const { cookie: cookieA } = await signupSalon(app, slugA);
    await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { cookie: cookieA },
      payload: { name: 'Cross Tenant Test' },
    });
    const { cookie: cookieB } = await signupSalon(app, slugB);

    const response = await app.inject({
      method: 'GET',
      url: '/api/customers/search?q=Cross',
      headers: { cookie: cookieB },
    });
    assert.deepEqual(response.json(), []);
  } finally {
    await cleanupSalon(slugA);
    await cleanupSalon(slugB);
    await app.close();
  }
});

test('GET /api/customers only lists customers of the caller\'s own salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slugA = uniqueSlug();
  const slugB = uniqueSlug();
  try {
    const { cookie: cookieA } = await signupSalon(app, slugA);
    await createCustomer(app, cookieA);
    const { cookie: cookieB } = await signupSalon(app, slugB);

    const response = await app.inject({ method: 'GET', url: '/api/customers', headers: { cookie: cookieB } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), []);
  } finally {
    await cleanupSalon(slugA);
    await cleanupSalon(slugB);
    await app.close();
  }
});
