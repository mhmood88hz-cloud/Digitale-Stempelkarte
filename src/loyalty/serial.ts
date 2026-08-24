import { randomBytes } from 'node:crypto';

/**
 * Generates a loyalty card serial number: encoded into the pass barcode and scanned by staff
 * to identify a card. Needs enough entropy that it can't be brute-forced or guessed, since
 * knowing it is one of the two things (together with a valid staff session) needed to add a
 * stamp or redeem a reward.
 */
export function generateSerialNumber(): string {
  return `LC-${randomBytes(16).toString('hex')}`;
}
