import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWalletPage } from './page';

const BASE = {
  salonName: 'Salon Beispiel',
  brandColor: '#ff0000',
  stampCount: 3,
  stampsRequired: 10,
  rewardReady: false,
  rewardDescription: '10 EUR Rabatt',
  serialNumber: 'LC-abc123',
};

test('renders the salon name and stamp progress', () => {
  const html = renderWalletPage(BASE);
  assert.match(html, /Salon Beispiel/);
  assert.match(html, /3 \/ 10 Stempel/);
});

test('shows the reward banner only when the reward is ready', () => {
  const notReady = renderWalletPage(BASE);
  assert.doesNotMatch(notReady, /Dein Rabatt ist bereit/);

  const ready = renderWalletPage({ ...BASE, rewardReady: true, stampCount: 10 });
  assert.match(ready, /Dein Rabatt ist bereit: 10 EUR Rabatt/);
});

test('escapes HTML in salon name and reward description to prevent injection', () => {
  const html = renderWalletPage({
    ...BASE,
    salonName: '<script>alert(1)</script>',
    rewardReady: true,
    rewardDescription: '"><img src=x>',
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /"><img src=x>/);
});

test('links to the per-card manifest URL', () => {
  const html = renderWalletPage(BASE);
  assert.match(html, /\/wallet\/LC-abc123\/manifest\.webmanifest/);
});
