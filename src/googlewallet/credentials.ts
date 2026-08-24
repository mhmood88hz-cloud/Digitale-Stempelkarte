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
 * clear message if either is missing, rather than failing later with a confusing signing error. */
export function loadGoogleWalletCredentials(env: NodeJS.ProcessEnv = process.env): GoogleWalletCredentials {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  const keyPath = env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (!issuerId) throw new Error('GOOGLE_WALLET_ISSUER_ID is not set (see .env.example)');
  if (!keyPath) throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is not set (see .env.example)');

  const raw = readFileSync(keyPath, 'utf8');
  const key: ServiceAccountKeyFile = JSON.parse(raw);
  if (!key.client_email || !key.private_key) {
    throw new Error(`${keyPath} does not look like a Google service account key (missing client_email/private_key)`);
  }

  return { issuerId, serviceAccountEmail: key.client_email, privateKeyPem: key.private_key };
}
