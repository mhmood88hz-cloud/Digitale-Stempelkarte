import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushLoyaltyObjectUpdate } from './updateObject';
import { loadGoogleWalletCredentials } from './credentials';

const googleWalletConfigured = Boolean(
  process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON,
);

// Deliberately does NOT depend on a real saved object existing (that requires a human to click
// "Add" in a browser first, see saveLink.ts) -- it only proves our own error propagation against
// Google's real API for an object that can never exist.
test(
  'throws a descriptive error against the real API when the object does not exist',
  { skip: !googleWalletConfigured && 'GOOGLE_WALLET_ISSUER_ID/GOOGLE_WALLET_SERVICE_ACCOUNT_JSON not configured' },
  async () => {
    const credentials = loadGoogleWalletCredentials();
    const objectId = `${credentials.issuerId}.LC-definitely-does-not-exist`;
    await assert.rejects(
      () => pushLoyaltyObjectUpdate(credentials, objectId, { stampCount: 1, stampsRequired: 10 }),
      /Google Wallet object update failed/,
    );
  },
);
