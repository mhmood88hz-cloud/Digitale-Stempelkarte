import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { buildApp } from '../app';

const prisma = new PrismaClient();
const PASSWORD = 'super-secret-pw';

function uniqueSlug(): string {
  return `test-superadmin-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupSalon(slug: string): Promise<void> {
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return;
  await prisma.staffUser.deleteMany({ where: { salonId: salon.id } });
  await prisma.salon.delete({ where: { id: salon.id } });
}

async function withHashConfigured<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.SUPERADMIN_PASSWORD_HASH;
  process.env.SUPERADMIN_PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.SUPERADMIN_PASSWORD_HASH;
    else process.env.SUPERADMIN_PASSWORD_HASH = previous;
  }
}

async function withHashUnset<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.SUPERADMIN_PASSWORD_HASH;
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  try {
    return await fn();
  } finally {
    if (previous !== undefined) process.env.SUPERADMIN_PASSWORD_HASH = previous;
  }
}

test('GET /api/superadmin/salons requires a superadmin session', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/api/superadmin/salons' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('login fails with the wrong password and with the endpoint unconfigured', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  try {
    await withHashUnset(async () => {
      const unconfigured = await app.inject({ method: 'POST', url: '/superadmin/login', payload: { password: 'anything' } });
      assert.equal(unconfigured.statusCode, 503);
    });

    await withHashConfigured(async () => {
      const wrong = await app.inject({ method: 'POST', url: '/superadmin/login', payload: { password: 'wrong' } });
      assert.equal(wrong.statusCode, 401);
    });
  } finally {
    await app.close();
  }
});

test('correct password logs in and lists salons; a normal staff session cannot', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await withHashConfigured(async () => {
      const login = await app.inject({ method: 'POST', url: '/superadmin/login', payload: { password: PASSWORD } });
      assert.equal(login.statusCode, 200);
      const cookie = String(login.headers['set-cookie']);

      const signup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { salonName: 'Superadmin Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
      });
      const staffCookie = String(signup.headers['set-cookie']);

      const list = await app.inject({ method: 'GET', url: '/api/superadmin/salons', headers: { cookie } });
      assert.equal(list.statusCode, 200);
      const salon = list.json().find((s: { slug: string }) => s.slug === slug);
      assert.ok(salon);
      assert.equal(salon.isActive, true);

      const staffTriesList = await app.inject({ method: 'GET', url: '/api/superadmin/salons', headers: { cookie: staffCookie } });
      assert.equal(staffTriesList.statusCode, 401);
    });
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('PATCH toggles isActive and immediately blocks/unblocks that salon\'s staff', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    await withHashConfigured(async () => {
      const login = await app.inject({ method: 'POST', url: '/superadmin/login', payload: { password: PASSWORD } });
      const cookie = String(login.headers['set-cookie']);

      const signup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { salonName: 'Superadmin Toggle Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
      });
      const salonId = signup.json().salon.id;
      const staffCookie = String(signup.headers['set-cookie']);

      const pause = await app.inject({
        method: 'PATCH',
        url: `/api/superadmin/salons/${salonId}`,
        headers: { cookie },
        payload: { isActive: false },
      });
      assert.equal(pause.statusCode, 200);
      assert.equal(pause.json().isActive, false);

      const blocked = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: staffCookie } });
      assert.equal(blocked.statusCode, 403);

      const reactivate = await app.inject({
        method: 'PATCH',
        url: `/api/superadmin/salons/${salonId}`,
        headers: { cookie },
        payload: { isActive: true },
      });
      assert.equal(reactivate.statusCode, 200);

      const unblocked = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: staffCookie } });
      assert.equal(unblocked.statusCode, 200);
    });
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('logout clears the superadmin session cookie', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'POST', url: '/superadmin/logout' });
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['set-cookie']), /Max-Age=0/);
  await app.close();
});

test('GET /superadmin serves the page without requiring auth (client JS handles the login gate)', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/superadmin' });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /login-form/);
  await app.close();
});
