import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStampRequestBody, parseStampResponse } from './scanClient';

test('buildStampRequestBody trims whitespace around the serial number', () => {
  assert.deepEqual(buildStampRequestBody('  LC-abc123  '), { serialNumber: 'LC-abc123' });
});

test('buildStampRequestBody throws on an empty (or whitespace-only) serial number', () => {
  assert.throws(() => buildStampRequestBody(''));
  assert.throws(() => buildStampRequestBody('   '));
});

test('parseStampResponse returns ok:true with the parsed result on 200', () => {
  const body = { stampCount: 4, stampsRequired: 10, rewardReady: false };
  assert.deepEqual(parseStampResponse(200, body), { ok: true, result: body });
});

test('parseStampResponse maps 401 to a German "not logged in" error', () => {
  assert.deepEqual(parseStampResponse(401, {}), { ok: false, error: 'Nicht angemeldet' });
});

test('parseStampResponse maps 404 to a German "card not found" error', () => {
  assert.deepEqual(parseStampResponse(404, {}), { ok: false, error: 'Karte nicht gefunden' });
});

test('parseStampResponse maps any other status to a generic German error', () => {
  assert.deepEqual(parseStampResponse(500, {}), { ok: false, error: 'Unbekannter Fehler' });
  assert.deepEqual(parseStampResponse(409, {}), { ok: false, error: 'Unbekannter Fehler' });
});
