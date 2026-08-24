import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSalonUpdateBody, buildAddStaffBody } from './adminClient';

test('buildSalonUpdateBody trims strings and only includes fields that were actually provided', () => {
  const body = buildSalonUpdateBody({ name: '  Salon Beispiel  ', rewardDescription: undefined });
  assert.deepEqual(body, { name: 'Salon Beispiel' });
});

test('buildSalonUpdateBody converts stampsRequired to a positive integer', () => {
  const body = buildSalonUpdateBody({ stampsRequired: '12' });
  assert.deepEqual(body, { stampsRequired: 12 });
});

test('buildSalonUpdateBody throws if stampsRequired is not a positive integer', () => {
  assert.throws(() => buildSalonUpdateBody({ stampsRequired: '0' }));
  assert.throws(() => buildSalonUpdateBody({ stampsRequired: 'not-a-number' }));
  assert.throws(() => buildSalonUpdateBody({ stampsRequired: '-3' }));
});

test('buildSalonUpdateBody drops empty-string fields instead of sending blanks', () => {
  const body = buildSalonUpdateBody({ name: '   ', brandColor: '#ff0000' });
  assert.deepEqual(body, { brandColor: '#ff0000' });
});

test('buildAddStaffBody trims the email and passes the password through unchanged', () => {
  const body = buildAddStaffBody('  staff@example.com  ', 'supersecret1');
  assert.deepEqual(body, { email: 'staff@example.com', password: 'supersecret1' });
});

test('buildAddStaffBody throws when the email is empty after trimming', () => {
  assert.throws(() => buildAddStaffBody('   ', 'supersecret1'));
});

test('buildAddStaffBody throws when the password is shorter than 8 characters', () => {
  assert.throws(() => buildAddStaffBody('staff@example.com', 'short'));
});
