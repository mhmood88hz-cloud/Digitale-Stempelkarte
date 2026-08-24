import { signRS256Jwt } from './jwt';
import { buildLoyaltyObjectPayload, type LoyaltyObjectInput } from './loyaltyObject';

export interface BuildSaveLinkInput extends LoyaltyObjectInput {
  serviceAccountEmail: string;
  privateKeyPem: string;
}

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';

/**
 * Builds the "Add to Google Wallet" save link: a JWT-encoded loyalty object, signed with the
 * issuer's service account key. Google's endpoint decodes and verifies this JWT itself when the
 * customer opens the link -- there's no separate API call needed to issue a card this way (only
 * later updates, e.g. after a stamp, go through the Wallet REST API instead).
 */
export function buildSaveLink(input: BuildSaveLinkInput): string {
  const loyaltyObject = buildLoyaltyObjectPayload(input);
  const payload = {
    iss: input.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [loyaltyObject] },
  };
  return `${SAVE_URL_PREFIX}${signRS256Jwt(payload, input.privateKeyPem)}`;
}
