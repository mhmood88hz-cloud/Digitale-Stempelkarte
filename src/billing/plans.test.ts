import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePriceId } from './plans';

test('resolves a known plan to its configured Stripe Price id', () => {
  const priceId = resolvePriceId('starter', { STRIPE_PRICE_STARTER: 'price_abc123' });
  assert.equal(priceId, 'price_abc123');
});

test('throws for an unknown plan id', () => {
  assert.throws(() => resolvePriceId('does-not-exist', {}), /Unknown billing plan/);
});

test('throws when the plan is known but its env var is not set', () => {
  assert.throws(() => resolvePriceId('starter', {}), /STRIPE_PRICE_STARTER/);
});
