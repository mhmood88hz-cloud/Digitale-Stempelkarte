import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from './session';

const SECRET = 'test-secret';
const PAYLOAD = { staffUserId: 'staff-1', salonId: 'salon-1', role: 'owner' };

test('a freshly created token verifies back to the same payload', () => {
  const token = createSessionToken(PAYLOAD, SECRET);
  assert.deepEqual(verifySessionToken(token, SECRET), PAYLOAD);
});

test('a token signed with a different secret is rejected', () => {
  const token = createSessionToken(PAYLOAD, SECRET);
  assert.equal(verifySessionToken(token, 'other-secret'), null);
});

test('a tampered payload is rejected', () => {
  const token = createSessionToken(PAYLOAD, SECRET);
  const [payloadB64, signature] = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...PAYLOAD, role: 'owner-but-tampered', exp: Date.now() + 100000 }),
  ).toString('base64url');
  assert.equal(verifySessionToken(`${tamperedPayload}.${signature}`, SECRET), null);
  assert.notEqual(payloadB64, tamperedPayload);
});

test('an expired token is rejected', () => {
  const token = createSessionToken(PAYLOAD, SECRET, -1000);
  assert.equal(verifySessionToken(token, SECRET), null);
});

test('a malformed token is rejected', () => {
  assert.equal(verifySessionToken('not-a-valid-token', SECRET), null);
  assert.equal(verifySessionToken('', SECRET), null);
});
