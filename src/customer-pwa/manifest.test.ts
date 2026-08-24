import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest } from './manifest';

test('builds a manifest pointing start_url at this card', () => {
  const manifest = buildManifest({ salonName: 'Salon Beispiel', brandColor: '#ff0000', serialNumber: 'LC-abc123' });
  assert.equal(manifest.start_url, '/wallet/LC-abc123');
  assert.equal(manifest.theme_color, '#ff0000');
  assert.equal(manifest.display, 'standalone');
});

test('includes an icon entry when a logo URL is set, omits it otherwise', () => {
  const withLogo = buildManifest({
    salonName: 'Salon Beispiel',
    brandColor: '#ff0000',
    serialNumber: 'LC-abc123',
    logoUrl: 'https://example.com/logo.png',
  });
  assert.deepEqual(withLogo.icons, [{ src: 'https://example.com/logo.png', sizes: '192x192', type: 'image/png' }]);

  const withoutLogo = buildManifest({ salonName: 'Salon Beispiel', brandColor: '#ff0000', serialNumber: 'LC-abc123' });
  assert.deepEqual(withoutLogo.icons, []);
});
