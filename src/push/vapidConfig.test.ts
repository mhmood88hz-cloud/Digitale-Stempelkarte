import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVapidConfig } from './vapidConfig';

const FULL_ENV = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@example.com' };

test('loads all three VAPID values from env', () => {
  const config = loadVapidConfig(FULL_ENV);
  assert.deepEqual(config, { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@example.com' });
});

test('throws a clear error when VAPID_PUBLIC_KEY is missing', () => {
  const { VAPID_PUBLIC_KEY, ...rest } = FULL_ENV;
  assert.throws(() => loadVapidConfig(rest), /VAPID_PUBLIC_KEY/);
});

test('throws a clear error when VAPID_PRIVATE_KEY is missing', () => {
  const { VAPID_PRIVATE_KEY, ...rest } = FULL_ENV;
  assert.throws(() => loadVapidConfig(rest), /VAPID_PRIVATE_KEY/);
});

test('throws a clear error when VAPID_SUBJECT is missing', () => {
  const { VAPID_SUBJECT, ...rest } = FULL_ENV;
  assert.throws(() => loadVapidConfig(rest), /VAPID_SUBJECT/);
});
