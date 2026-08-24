import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { verifyWebhookEvent, handleWebhookEvent } from './webhookHandler';

// A fake key is fine here: signature verification is pure local HMAC, no network call to
// Stripe happens for any of this.
const stripe = new Stripe('sk_test_fake_key_for_local_signing_only');
const WEBHOOK_SECRET = 'whsec_test_secret';
const prisma = new PrismaClient();

function signPayload(payload: string): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

test('verifyWebhookEvent accepts a correctly signed payload', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
  const signature = signPayload(payload);
  const event = verifyWebhookEvent(stripe, Buffer.from(payload), signature, WEBHOOK_SECRET);
  assert.equal(event.type, 'checkout.session.completed');
});

test('verifyWebhookEvent rejects a bogus signature', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
  assert.throws(() => verifyWebhookEvent(stripe, Buffer.from(payload), 't=1,v1=deadbeef', WEBHOOK_SECRET));
});

test('verifyWebhookEvent rejects a tampered payload even with a signature valid for the original', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
  const signature = signPayload(payload);
  const tampered = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { tampered: true } } });
  assert.throws(() => verifyWebhookEvent(stripe, Buffer.from(tampered), signature, WEBHOOK_SECRET));
});

function uniqueSlug(): string {
  return `test-billing-${crypto.randomUUID().slice(0, 8)}`;
}

test('handleWebhookEvent activates a salon on checkout.session.completed', async () => {
  const salon = await prisma.salon.create({
    data: { name: 'Billing Test Salon', slug: uniqueSlug(), trialEndsAt: new Date() },
  });
  try {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: salon.id, customer: 'cus_123', subscription: 'sub_123' } },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(prisma, event);

    const updated = await prisma.salon.findUniqueOrThrow({ where: { id: salon.id } });
    assert.equal(updated.subscriptionStatus, 'active');
    assert.equal(updated.stripeCustomerId, 'cus_123');
    assert.equal(updated.stripeSubscriptionId, 'sub_123');
  } finally {
    await prisma.salon.delete({ where: { id: salon.id } });
  }
});

test('handleWebhookEvent cancels a salon on customer.subscription.deleted', async () => {
  const salon = await prisma.salon.create({
    data: {
      name: 'Billing Test Salon 2',
      slug: uniqueSlug(),
      trialEndsAt: new Date(),
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_456',
    },
  });
  try {
    const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_456' } } } as unknown as Stripe.Event;
    await handleWebhookEvent(prisma, event);

    const updated = await prisma.salon.findUniqueOrThrow({ where: { id: salon.id } });
    assert.equal(updated.subscriptionStatus, 'canceled');
  } finally {
    await prisma.salon.delete({ where: { id: salon.id } });
  }
});

test('handleWebhookEvent ignores event types it does not act on', async () => {
  const event = { type: 'invoice.paid', data: { object: {} } } as unknown as Stripe.Event;
  await assert.doesNotReject(() => handleWebhookEvent(prisma, event));
});
