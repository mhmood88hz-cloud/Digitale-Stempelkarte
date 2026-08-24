import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLoyaltyClassId, buildLoyaltyObjectId, buildLoyaltyClassPayload, buildLoyaltyObjectPayload } from './loyaltyObject';

test('class and object ids are namespaced under the issuer id', () => {
  assert.equal(buildLoyaltyClassId('3388000000012345', 'salon-beispiel'), '3388000000012345.salon-beispiel');
  assert.equal(buildLoyaltyObjectId('3388000000012345', 'LC-abc123'), '3388000000012345.LC-abc123');
});

test('loyalty class payload carries the salon branding', () => {
  const payload = buildLoyaltyClassPayload({
    issuerId: '3388000000012345',
    classSuffix: 'salon-beispiel',
    salonName: 'Salon Beispiel',
    hexBackgroundColor: '#ff0000',
  });
  assert.equal(payload.id, '3388000000012345.salon-beispiel');
  assert.equal(payload.issuerName, 'Salon Beispiel');
  assert.equal(payload.hexBackgroundColor, '#ff0000');
});

test('loyalty object payload carries the stamp progress and a QR barcode of the serial number', () => {
  const payload = buildLoyaltyObjectPayload({
    issuerId: '3388000000012345',
    classSuffix: 'salon-beispiel',
    serialNumber: 'LC-abc123',
    salonName: 'Salon Beispiel',
    stampCount: 4,
    stampsRequired: 10,
    hexBackgroundColor: '#ff0000',
  });
  assert.equal(payload.id, '3388000000012345.LC-abc123');
  assert.equal(payload.classId, '3388000000012345.salon-beispiel');
  assert.deepEqual(payload.loyaltyPoints, { label: 'Stempel', balance: { string: '4 / 10' } });
  assert.deepEqual(payload.barcode, { type: 'QR_CODE', value: 'LC-abc123' });
});
