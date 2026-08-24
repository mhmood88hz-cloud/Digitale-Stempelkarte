export interface LoyaltyObjectInput {
  issuerId: string;
  classSuffix: string;
  serialNumber: string;
  salonName: string;
  stampCount: number;
  stampsRequired: number;
  hexBackgroundColor: string;
}

export function buildLoyaltyClassId(issuerId: string, classSuffix: string): string {
  return `${issuerId}.${classSuffix}`;
}

export function buildLoyaltyObjectId(issuerId: string, serialNumber: string): string {
  return `${issuerId}.${serialNumber}`;
}

/** One class per salon (the "loyalty program" definition); see Google Wallet Loyalty Class docs. */
export function buildLoyaltyClassPayload(input: {
  issuerId: string;
  classSuffix: string;
  salonName: string;
  hexBackgroundColor: string;
}): Record<string, unknown> {
  return {
    id: buildLoyaltyClassId(input.issuerId, input.classSuffix),
    issuerName: input.salonName,
    programName: `${input.salonName} Stempelkarte`,
    hexBackgroundColor: input.hexBackgroundColor,
    reviewStatus: 'UNDER_REVIEW',
  };
}

/** One object per customer's card; see Google Wallet Loyalty Object docs. */
export function buildLoyaltyObjectPayload(input: LoyaltyObjectInput): Record<string, unknown> {
  return {
    id: buildLoyaltyObjectId(input.issuerId, input.serialNumber),
    classId: buildLoyaltyClassId(input.issuerId, input.classSuffix),
    state: 'ACTIVE',
    accountName: input.salonName,
    loyaltyPoints: {
      label: 'Stempel',
      balance: { string: `${input.stampCount} / ${input.stampsRequired}` },
    },
    barcode: {
      type: 'QR_CODE',
      value: input.serialNumber,
    },
  };
}
