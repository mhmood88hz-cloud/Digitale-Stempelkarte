import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../app';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-report-${crypto.randomUUID().slice(0, 8)}`;
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

test('GET /api/reports/monthly requires authentication', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const response = await app.inject({ method: 'GET', url: '/api/reports/monthly' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /api/reports/monthly rejects a malformed month', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Report Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const response = await app.inject({ method: 'GET', url: '/api/reports/monthly?month=not-a-month', headers: { cookie } });
    assert.equal(response.statusCode, 400);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/reports/monthly counts new customers, stamps, and redemptions within the period', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Report Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const customer1 = await app.inject({ method: 'POST', url: '/api/customers', headers: { cookie }, payload: { name: 'Jane' } });
    const customer2 = await app.inject({ method: 'POST', url: '/api/customers', headers: { cookie }, payload: { name: 'John' } });
    const serial1 = customer1.json().loyaltyCard.serialNumber;
    const serial2 = customer2.json().loyaltyCard.serialNumber;

    await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber: serial1 } });
    await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber: serial1 } });
    await app.inject({ method: 'POST', url: '/api/stamps', headers: { cookie }, payload: { serialNumber: serial2 } });

    const thisMonth = new Date().toISOString().slice(0, 7);
    const response = await app.inject({ method: 'GET', url: `/api/reports/monthly?month=${thisMonth}`, headers: { cookie } });
    assert.equal(response.statusCode, 200);
    const report = response.json();
    assert.equal(report.newCustomers, 2);
    assert.equal(report.stampsIssued, 3);
    assert.equal(report.redemptions, 0);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});

test('GET /api/reports/monthly defaults to the current month when no month is given', async () => {
  const app = buildApp({ prisma, sessionSecret: 'test-secret' });
  const slug = uniqueSlug();
  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { salonName: 'Report Test Salon', slug, ownerEmail: 'owner@example.com', password: 'supersecret1' },
    });
    const cookie = String(signup.headers['set-cookie']);

    const response = await app.inject({ method: 'GET', url: '/api/reports/monthly', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().newCustomers, 0);
  } finally {
    await cleanupSalon(slug);
    await app.close();
  }
});
