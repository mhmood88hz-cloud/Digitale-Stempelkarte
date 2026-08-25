import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createSalonWithOwner, TRIAL_DURATION_MS } from './staffRepository';

const prisma = new PrismaClient();

function uniqueSlug(): string {
  return `test-trial-${crypto.randomUUID().slice(0, 8)}`;
}

test('a new salon starts on a trial lasting TRIAL_DURATION_MS', async () => {
  const slug = uniqueSlug();
  const before = Date.now();
  try {
    const { salon } = await createSalonWithOwner(prisma, {
      salonName: 'Trial Test Salon',
      slug,
      ownerEmail: 'owner@example.com',
      passwordHash: 'irrelevant-for-this-test',
    });
    assert.equal(salon.subscriptionStatus, 'trial');

    const expectedTrialEnd = before + TRIAL_DURATION_MS;
    const actualTrialEnd = salon.trialEndsAt.getTime();
    assert.ok(
      Math.abs(actualTrialEnd - expectedTrialEnd) < 5000,
      `expected trialEndsAt near ${new Date(expectedTrialEnd).toISOString()}, got ${salon.trialEndsAt.toISOString()}`,
    );
  } finally {
    await prisma.staffUser.deleteMany({ where: { salon: { slug } } });
    await prisma.salon.deleteMany({ where: { slug } });
  }
});
