import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-salon-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

test('signup creates a salon + owner and sets a session cookie', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    assert.equal(response.statusCode, 201);
    assert.ok(response.headers['set-cookie']);
    const body = response.json();
    assert.equal(body.salon.slug, slug);
    assert.equal(body.staffUser.role, 'owner');
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('signup rejects a duplicate slug', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'a@example.com', password: 'supersecret1' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon 2', slug, ownerEmail: 'b@example.com', password: 'supersecret1' },
    });
    assert.equal(response.statusCode, 409);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('signup rejects an invalid slug', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { salonName: 'Test Salon', slug: 'Not A Slug!', ownerEmail: 'a@example.com', password: 'supersecret1' },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test('login succeeds with correct credentials and fails with a wrong password', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });

    const ok = await app.inject({
      method: 'POST',
      url: `/salons/${slug}/auth/login`,
      payload: { email: 'owner@example.com', password: 'supersecret1' },
    });
    assert.equal(ok.statusCode, 200);
    assert.ok(ok.headers['set-cookie']);

    const wrong = await app.inject({
      method: 'POST',
      url: `/salons/${slug}/auth/login`,
      payload: { email: 'owner@example.com', password: 'wrong-password' },
    });
    assert.equal(wrong.statusCode, 401);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('login fails for an unknown salon slug', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({
    method: 'POST',
    url: '/salons/does-not-exist/auth/login',
    payload: { email: 'x@example.com', password: 'whatever1' },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('a signup session cookie authenticates /auth/me with the right salon', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = signup.headers['set-cookie'];
    assert.ok(cookie);

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: String(cookie) } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().salonId, signup.json().salon.id);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('logout clears the session cookie', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'POST', url: '/auth/logout' });
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['set-cookie']), /Max-Age=0/);
  await app.close();
});

test('login is refused for a salon the platform owner has paused', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    await prisma.salon.update({ where: { slug }, data: { isActive: false } });

    const response = await app.inject({
      method: 'POST',
      url: `/salons/${slug}/auth/login`,
      payload: { email: 'owner@example.com', password: 'supersecret1' },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, 'salon_paused');
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('pausing a salon blocks an already-logged-in session on its very next request', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const before = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    assert.equal(before.statusCode, 200);

    await prisma.salon.update({ where: { slug }, data: { isActive: false } });

    const after = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    assert.equal(after.statusCode, 403);
    assert.equal(after.json().error, 'salon_paused');

    // Logout must still work so staff can clear their own cookie once paused.
    const logout = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    assert.equal(logout.statusCode, 200);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});
