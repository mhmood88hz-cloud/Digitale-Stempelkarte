import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildSaveLink } from './saveLink';

// Throwaway keypair for this test run only -- NOT a real Google service account credential.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const INPUT = {
  issuerId: '3388000000012345',
  classSuffix: 'salon-beispiel',
  serialNumber: 'LC-abc123',
  salonName: 'Salon Beispiel',
  stampCount: 4,
  stampsRequired: 10,
  hexBackgroundColor: '#ff0000',
  programLogoUrl: 'https://example.com/logo.png',
  serviceAccountEmail: 'wallet@example-project.iam.gserviceaccount.com',
  privateKeyPem: privateKey,
};

test('builds a pay.google.com save link with a validly signed JWT', () => {
  const link = buildSaveLink(INPUT);
  assert.match(link, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);

  const jwt = link.replace('https://pay.google.com/gp/v/save/', '');
  const [headerB64, payloadB64, signatureB64] = jwt.split('.');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  assert.equal(verifier.verify(publicKey, Buffer.from(signatureB64, 'base64url')), true);
});

test('the signed payload embeds exactly one loyalty object with the current stamp count', () => {
  const link = buildSaveLink(INPUT);
  const jwt = link.replace('https://pay.google.com/gp/v/save/', '');
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

  assert.equal(payload.iss, INPUT.serviceAccountEmail);
  assert.equal(payload.aud, 'google');
  assert.equal(payload.typ, 'savetowallet');
  assert.equal(payload.payload.loyaltyObjects.length, 1);
  assert.deepEqual(payload.payload.loyaltyObjects[0].loyaltyPoints.balance, { string: '4 / 10' });
});

test('the signed payload also embeds the loyalty class the object references (auto-provisions on first save)', () => {
  const link = buildSaveLink(INPUT);
  const jwt = link.replace('https://pay.google.com/gp/v/save/', '');
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

  assert.equal(payload.payload.loyaltyClasses.length, 1);
  const [loyaltyClass] = payload.payload.loyaltyClasses;
  assert.equal(loyaltyClass.id, `${INPUT.issuerId}.${INPUT.classSuffix}`);
  assert.equal(loyaltyClass.id, payload.payload.loyaltyObjects[0].classId);
});
