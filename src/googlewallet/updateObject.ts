import { getAccessToken } from './accessToken';
import type { GoogleWalletCredentials } from './credentials';

const OBJECT_URL_PREFIX = 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/';

export interface StampProgressPatch {
  stampCount: number;
  stampsRequired: number;
}

/**
 * Pushes an updated stamp count to an already-saved Google Wallet loyalty object. This is a
 * PATCH against the real Wallet REST API (not the JWT save-link flow, which only handles the
 * initial save) -- it's how a card the customer already has in their Wallet reflects a new
 * stamp without them re-saving anything.
 */
export async function pushLoyaltyObjectUpdate(
  credentials: GoogleWalletCredentials,
  objectId: string,
  patch: StampProgressPatch,
): Promise<void> {
  const accessToken = await getAccessToken(credentials);
  const response = await fetch(`${OBJECT_URL_PREFIX}${objectId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loyaltyPoints: {
        label: 'Stempel',
        balance: { string: `${patch.stampCount} / ${patch.stampsRequired}` },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Wallet object update failed: ${response.status} ${await response.text()}`);
  }
}
