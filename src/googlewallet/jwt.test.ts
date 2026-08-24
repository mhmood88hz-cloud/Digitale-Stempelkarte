import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { signRS256Jwt } from './jwt';

// Throwaway keypair generated for this test run only -- NOT a real Google credential.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function decodePart(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

test('produces a JWT with a valid RS256 signature verifiable against the public key', () => {
  const jwt = signRS256Jwt({ hello: 'world' }, privateKey);
  const [headerB64, payloadB64, signatureB64] = jwt.split('.');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  assert.equal(verifier.verify(publicKey, Buffer.from(signatureB64, 'base64url')), true);
});

test('encodes header and payload as valid base64url JSON', () => {
  const jwt = signRS256Jwt({ foo: 'bar', n: 42 }, privateKey);
  const [headerB64, payloadB64] = jwt.split('.');
  assert.deepEqual(decodePart(headerB64), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(decodePart(payloadB64), { foo: 'bar', n: 42 });
});

test('a tampered payload fails signature verification', () => {
  const jwt = signRS256Jwt({ hello: 'world' }, privateKey);
  const [headerB64, , signatureB64] = jwt.split('.');
  const tamperedPayloadB64 = Buffer.from(JSON.stringify({ hello: 'tampered' })).toString('base64url');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${tamperedPayloadB64}`);
  verifier.end();
  assert.equal(verifier.verify(publicKey, Buffer.from(signatureB64, 'base64url')), false);
});
