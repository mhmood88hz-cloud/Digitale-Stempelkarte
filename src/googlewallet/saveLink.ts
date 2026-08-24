import { signRS256Jwt } from './jwt';
import { buildLoyaltyClassPayload, buildLoyaltyObjectPayload, type LoyaltyObjectInput } from './loyaltyObject';

export interface BuildSaveLinkInput extends LoyaltyObjectInput {
  serviceAccountEmail: string;
  privateKeyPem: string;
}

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';

/**
 * Builds the "Add to Google Wallet" save link: a JWT-encoded loyalty class + object, signed
 * with the issuer's service account key. Google's endpoint decodes and verifies this JWT itself
 * when the customer opens the link. The class is included inline (not pre-created via a
 * separate REST call) so the very first save for a salon auto-provisions it -- Google rejects
 * an object whose classId doesn't exist yet ("Could not find necessary class ..."), and every
 * loyalty card for the same salon shares one classId, so only the first save actually creates
 * anything; later ones just reference the now-existing class. Later object *updates* (e.g.
 * after a stamp) go through the Wallet REST API instead, not this JWT flow.
 */
export function buildSaveLink(input: BuildSaveLinkInput): string {
  const loyaltyClass = buildLoyaltyClassPayload(input);
  const loyaltyObject = buildLoyaltyObjectPayload(input);
  const payload = {
    iss: input.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyClasses: [loyaltyClass], loyaltyObjects: [loyaltyObject] },
  };
  return `${SAVE_URL_PREFIX}${signRS256Jwt(payload, input.privateKeyPem)}`;
}
