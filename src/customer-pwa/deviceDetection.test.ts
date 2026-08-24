import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppleMobileDevice } from './deviceDetection';

test('detects iPhone Safari', () => {
  assert.equal(
    isAppleMobileDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ),
    true,
  );
});

test('detects iPad Safari', () => {
  assert.equal(
    isAppleMobileDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
    true,
  );
});

test('does not flag Android Chrome', () => {
  assert.equal(
    isAppleMobileDevice(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    ),
    false,
  );
});

test('does not flag desktop Chrome/macOS', () => {
  assert.equal(
    isAppleMobileDevice(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ),
    false,
  );
});

test('returns false when no User-Agent header is present', () => {
  assert.equal(isAppleMobileDevice(undefined), false);
});
