import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccessToken } from './accessToken';
import { loadGoogleWalletCredentials } from './credentials';

const googleWalletConfigured = Boolean(
  process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON,
);

test(
  'exchanges the real service account key for a usable OAuth2 access token',
  { skip: !googleWalletConfigured && 'GOOGLE_WALLET_ISSUER_ID/GOOGLE_WALLET_SERVICE_ACCOUNT_JSON not configured' },
  async () => {
    const credentials = loadGoogleWalletCredentials();
    const token = await getAccessToken(credentials);
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 20);
  },
);
