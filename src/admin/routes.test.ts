import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-admin-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.stampEvent.deleteMany({ where: { loyaltyCard: { salonId: salon.id } } });
  await prisma.redemption.deleteMany({ where: { loyaltyCard: { salonId: salon.id } } });
  await prisma.pushSubscription.deleteMany({ where: { loyaltyCard: { salonId: salon.id } } });
  await prisma.loyaltyCard.deleteMany({ where: { salonId: salon.id } });
  await prisma.customer.deleteMany({ where: { salonId: salon.id } });
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

async function signupSalon(app: ReturnType<typeof buildApp>, slug: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { salonName: 'Admin Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
  });
  return String(response.headers['set-cookie']);
}

test('GET /api/salon returns the current salon settings', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    const response = await app.inject({ method: 'GET', url: '/api/salon', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().slug, slug);
    assert.equal(response.json().stampsRequired, 10);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('PATCH /api/salon updates settings when called by the owner', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/salon',
      headers: { cookie },
      payload: { stampsRequired: 6, rewardDescription: '5 EUR Rabatt' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().stampsRequired, 6);
    assert.equal(response.json().rewardDescription, '5 EUR Rabatt');
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('PATCH /api/salon is rejected for a non-owner staff session', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const ownerCookie = await signupSalon(app, slug);
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
      method: 'PATCH',
      url: '/api/salon',
      headers: { cookie: staffCookie },
      payload: { stampsRequired: 3 },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('POST /api/staff adds a staff member; email must be unique per salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    const created = await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie },
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().role, 'staff');

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie },
      payload: { email: 'staff@example.com', password: 'anotherpass1' },
    });
    assert.equal(duplicate.statusCode, 409);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/staff lists staff without exposing password hashes', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie },
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/staff', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    const staff = response.json();
    assert.equal(staff.length, 2); // owner + the newly added staff member
    for (const member of staff) {
      assert.equal('passwordHash' in member, false);
    }
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('DELETE /api/staff/:id removes a staff member, but refuses to remove the last owner', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    const created = await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie },
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });
    const staffId = created.json().id;

    const removed = await app.inject({ method: 'DELETE', url: `/api/staff/${staffId}`, headers: { cookie } });
    assert.equal(removed.statusCode, 204);

    const staffList = await app.inject({ method: 'GET', url: '/api/staff', headers: { cookie } });
    assert.equal(staffList.json().length, 1);

    const [owner] = staffList.json();
    const removeOwner = await app.inject({ method: 'DELETE', url: `/api/staff/${owner.id}`, headers: { cookie } });
    assert.equal(removeOwner.statusCode, 409);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('DELETE /api/staff/:id succeeds with a real browser fetch\'s headers (Content-Type set, empty JSON object body)', async () => {
  // Regression test: the admin page's JS used to always set Content-Type: application/json even
  // for requests with nothing to send -- Fastify's default JSON parser rejects a genuinely empty
  // body under that content type (FST_ERR_CTP_EMPTY_JSON_BODY, found live: DELETE staff / POST
  // reminders both 400'd in the real browser despite passing here before, because
  // app.inject() without an explicit body doesn't send Content-Type at all, missing the bug).
  // Fixed client-side (adminPage.ts's api() helper now defaults body to '{}'); this locks that in.
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);
    const created = await app.inject({
      method: 'POST',
      url: '/api/staff',
      headers: { cookie },
      payload: { email: 'staff@example.com', password: 'staffpass1' },
    });
    const staffId = created.json().id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${staffId}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(response.statusCode, 204);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/staff reports how many stamps each staff member gave today', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const cookie = await signupSalon(app, slug);

    const customer = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { cookie },
      payload: { name: 'Stamp Test Customer' },
    });
    const serialNumber = customer.json().loyaltyCard.serialNumber;

    const before = await app.inject({ method: 'GET', url: '/api/staff', headers: { cookie } });
    assert.equal(before.json()[0].stampsToday, 0);

    const stamp = await app.inject({
      method: 'POST',
      url: '/api/stamps',
      headers: { cookie },
      payload: { serialNumber },
    });
    assert.equal(stamp.statusCode, 200);

    const after = await app.inject({ method: 'GET', url: '/api/staff', headers: { cookie } });
    assert.equal(after.json()[0].stampsToday, 1);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('staff management endpoints require authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const responses = await Promise.all([
    app.inject({ method: 'GET', url: '/api/salon' }),
    app.inject({ method: 'GET', url: '/api/staff' }),
    app.inject({ method: 'POST', url: '/api/staff', payload: { email: 'x@example.com', password: 'whatever1' } }),
    app.inject({ method: 'DELETE', url: '/api/staff/does-not-matter' }),
  ]);
  for (const response of responses) {
    assert.equal(response.statusCode, 401);
  }
  await app.close();
});
