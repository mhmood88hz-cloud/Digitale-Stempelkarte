import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadGoogleWalletCredentials } from './credentials';

function tempKeyFile(content: unknown): string {
  const path = join(tmpdir(), `fake-key-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(content));
  return path;
}

test('loads issuer id and parses the service account key file', () => {
  const path = tempKeyFile({ client_email: 'wallet@example.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----' });
  try {
    const creds = loadGoogleWalletCredentials({ GOOGLE_WALLET_ISSUER_ID: '12345', GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: path });
    assert.equal(creds.issuerId, '12345');
    assert.equal(creds.serviceAccountEmail, 'wallet@example.iam.gserviceaccount.com');
    assert.match(creds.privateKeyPem, /BEGIN PRIVATE KEY/);
  } finally {
    unlinkSync(path);
  }
});

test('throws a clear error when GOOGLE_WALLET_ISSUER_ID is missing', () => {
  assert.throws(
    () => loadGoogleWalletCredentials({ GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: 'irrelevant.json' }),
    /GOOGLE_WALLET_ISSUER_ID/,
  );
});

test('throws a clear error when GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is missing', () => {
  assert.throws(() => loadGoogleWalletCredentials({ GOOGLE_WALLET_ISSUER_ID: '12345' }), /GOOGLE_WALLET_SERVICE_ACCOUNT_JSON/);
});

test('throws when the key file is missing client_email/private_key', () => {
  const path = tempKeyFile({ some_other_field: true });
  try {
    assert.throws(
      () => loadGoogleWalletCredentials({ GOOGLE_WALLET_ISSUER_ID: '12345', GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: path }),
      /does not look like a Google service account key/,
    );
  } finally {
    unlinkSync(path);
  }
});
