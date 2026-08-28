import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { findCardsDueForReminder, sendManualReminder, sendPushNotification, sendRemindersForSalon } from './reminders';
import { saveSubscription } from './subscriptionRepository';

const prisma = new PrismaClient();
const FAKE_VAPID = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@example.com' };

function uniqueSlug(): string {
  return `test-reminders-${crypto.randomUUID().slice(0, 8)}`;
}

async function setupSalonWithCard(daysAgoCreated: number): Promise<{ salonId: string; cardId: string; serialNumber: string }> {
  const slug = uniqueSlug();
  const createdAt = new Date(Date.now() - daysAgoCreated * 24 * 60 * 60 * 1000);
  const salon = await prisma.salon.create({
    data: { name: 'Reminder Test Salon', slug, trialEndsAt: new Date(), reminderIntervalDays: 7 },
  });
  const customer = await prisma.customer.create({ data: { salonId: salon.id, name: 'Jane' } });
  const card = await prisma.loyaltyCard.create({
    data: {
      salonId: salon.id,
      customerId: customer.id,
      serialNumber: `LC-${crypto.randomUUID()}`,
      createdAt,
    },
  });
  return { salonId: salon.id, cardId: card.id, serialNumber: card.serialNumber };
}

async function cleanup(salonId: string): Promise<void> {
  const cards = await prisma.loyaltyCard.findMany({ where: { salonId }, select: { id: true } });
  const cardIds = cards.map((c) => c.id);
  await prisma.pushSubscription.deleteMany({ where: { loyaltyCardId: { in: cardIds } } });
  await prisma.stampEvent.deleteMany({ where: { loyaltyCardId: { in: cardIds } } });
  await prisma.loyaltyCard.deleteMany({ where: { salonId } });
  await prisma.customer.deleteMany({ where: { salonId } });
  await prisma.salon.delete({ where: { id: salonId } });
}

test('findCardsDueForReminder finds a card inactive past the interval with a subscription', async () => {
  const { salonId, cardId, serialNumber } = await setupSalonWithCard(10);
  try {
    await saveSubscription(prisma, {
      loyaltyCardId: cardId,
      endpoint: `https://example.com/ep-${crypto.randomUUID()}`,
      p256dhKey: 'p256dh',
      authKey: 'auth',
    });

    const due = await findCardsDueForReminder(prisma, salonId, 7);
    assert.equal(due.length, 1);
    assert.equal(due[0].loyaltyCardId, cardId);
    assert.equal(due[0].serialNumber, serialNumber);
    assert.equal(due[0].subscriptions.length, 1);
  } finally {
    await cleanup(salonId);
  }
});

test('findCardsDueForReminder excludes a card without any push subscription', async () => {
  const { salonId } = await setupSalonWithCard(10);
  try {
    const due = await findCardsDueForReminder(prisma, salonId, 7);
    assert.equal(due.length, 0);
  } finally {
    await cleanup(salonId);
  }
});

test('findCardsDueForReminder excludes a card whose last activity is within the interval', async () => {
  const { salonId, cardId } = await setupSalonWithCard(2);
  try {
    await saveSubscription(prisma, {
      loyaltyCardId: cardId,
      endpoint: `https://example.com/ep-${crypto.randomUUID()}`,
      p256dhKey: 'p256dh',
      authKey: 'auth',
    });
    const due = await findCardsDueForReminder(prisma, salonId, 7);
    assert.equal(due.length, 0);
  } finally {
    await cleanup(salonId);
  }
});

test('findCardsDueForReminder excludes a card already reminded within the interval', async () => {
  const { salonId, cardId } = await setupSalonWithCard(10);
  try {
    await saveSubscription(prisma, {
      loyaltyCardId: cardId,
      endpoint: `https://example.com/ep-${crypto.randomUUID()}`,
      p256dhKey: 'p256dh',
      authKey: 'auth',
    });
    await prisma.loyaltyCard.update({
      where: { id: cardId },
      data: { lastReminderSentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    });
    const due = await findCardsDueForReminder(prisma, salonId, 7);
    assert.equal(due.length, 0);
  } finally {
    await cleanup(salonId);
  }
});

test('sendPushNotification against an unreachable endpoint fails gracefully (no throw)', async () => {
  const result = await sendPushNotification(
    FAKE_VAPID,
    { endpoint: 'https://example.com/definitely-not-a-real-push-endpoint', p256dhKey: 'p256dh', authKey: 'auth' },
    { title: 'Test', body: 'Test', url: '/wallet/LC-abc123' },
  );
  assert.equal(result.ok, false);
});

test('sendRemindersForSalon is a no-op when reminderIntervalDays is not set', async () => {
  const result = await sendRemindersForSalon(prisma, FAKE_VAPID, {
    id: 'irrelevant',
    name: 'Irrelevant Salon',
    reminderIntervalDays: null,
  });
  assert.deepEqual(result, { sent: 0 });
});

test('sendManualReminder reports no_subscription for a card with none', async () => {
  const { salonId, serialNumber } = await setupSalonWithCard(0);
  try {
    const result = await sendManualReminder(prisma, FAKE_VAPID, { id: salonId, name: 'Reminder Test Salon' }, serialNumber);
    assert.deepEqual(result, { status: 'no_subscription' });
  } finally {
    await cleanup(salonId);
  }
});

test('sendManualReminder is scoped by salon -- a card from another salon is not found', async () => {
  const salonA = await setupSalonWithCard(0);
  const salonB = await setupSalonWithCard(0);
  try {
    await saveSubscription(prisma, {
      loyaltyCardId: salonA.cardId,
      endpoint: `https://example.com/ep-${crypto.randomUUID()}`,
      p256dhKey: 'p256dh',
      authKey: 'auth',
    });
    // Card belongs to salon A, but we ask on behalf of salon B.
    const result = await sendManualReminder(
      prisma,
      FAKE_VAPID,
      { id: salonB.salonId, name: 'Salon B' },
      salonA.serialNumber,
    );
    assert.deepEqual(result, { status: 'no_subscription' });
  } finally {
    await cleanup(salonA.salonId);
    await cleanup(salonB.salonId);
  }
});
