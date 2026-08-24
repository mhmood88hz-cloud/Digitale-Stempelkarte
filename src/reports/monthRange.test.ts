import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth, currentMonth } from './monthRange';

test('parseMonth covers the full calendar month, start inclusive end exclusive', () => {
  const { start, end } = parseMonth('2026-02');
  assert.equal(start.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-01T00:00:00.000Z');
});

test('parseMonth handles December (year rollover)', () => {
  const { start, end } = parseMonth('2025-12');
  assert.equal(start.toISOString(), '2025-12-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('parseMonth rejects malformed input', () => {
  assert.throws(() => parseMonth('2026-13'));
  assert.throws(() => parseMonth('2026-00'));
  assert.throws(() => parseMonth('not-a-month'));
  assert.throws(() => parseMonth('2026/02'));
});

test('currentMonth returns the calendar month containing the given date', () => {
  const { start, end } = currentMonth(new Date('2026-08-15T12:00:00.000Z'));
  assert.equal(start.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-09-01T00:00:00.000Z');
});
