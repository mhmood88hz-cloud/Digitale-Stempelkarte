import { readFileSync } from 'node:fs';

export interface GoogleWalletCredentials {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyPem: string;
}

interface ServiceAccountKeyFile {
  client_email: string;
  private_key: string;
}

/** Reads GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SERVICE_ACCOUNT_JSON from env. Throws with a
 * clear message if either is missing, rather than failing later with a confusing signing error.
 *
 * GOOGLE_WALLET_SERVICE_ACCOUNT_JSON accepts two forms: a path to the key file (local dev,
 * secrets/... is gitignored) or the raw JSON content itself (a value starting with "{") -- the
 * latter means a hosting platform's plain environment variables are enough on their own, no
 * separate "secret file" upload feature needed. */
export function loadGoogleWalletCredentials(env: NodeJS.ProcessEnv = process.env): GoogleWalletCredentials {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  const rawSetting = env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (!issuerId) throw new Error('GOOGLE_WALLET_ISSUER_ID is not set (see .env.example)');
  if (!rawSetting) throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is not set (see .env.example)');

  const raw = rawSetting.trim().startsWith('{') ? rawSetting : readFileSync(rawSetting, 'utf8');
  const key: ServiceAccountKeyFile = JSON.parse(raw);
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON does not look like a Google service account key (missing client_email/private_key)');
  }

  return { issuerId, serviceAccountEmail: key.client_email, privateKeyPem: key.private_key };
}
