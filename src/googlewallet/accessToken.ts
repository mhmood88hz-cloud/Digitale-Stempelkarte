import { signRS256Jwt } from './jwt';
import type { GoogleWalletCredentials } from './credentials';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUER_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

interface TokenResponse {
  access_token: string;
}

/**
 * Exchanges the service account key for a short-lived OAuth2 access token (service-account
 * JWT-bearer flow), needed for direct Wallet REST API calls -- e.g. updating an already-saved
 * object's stamp count. Separate from the "save to wallet" JWT in saveLink.ts, which Google
 * verifies itself and never touches this OAuth flow.
 */
export async function getAccessToken(credentials: GoogleWalletCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRS256Jwt(
    {
      iss: credentials.serviceAccountEmail,
      scope: ISSUER_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    credentials.privateKeyPem,
  );

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as TokenResponse;
  return body.access_token;
}
