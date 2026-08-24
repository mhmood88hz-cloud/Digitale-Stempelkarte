import type { LoyaltyCard, PrismaClient, Salon } from '@prisma/client';

/**
 * Looks up a loyalty card by serial number, scoped to a salon. Scoping by salonId (not just
 * serialNumber) is the multi-tenant boundary here: staff can never stamp/redeem a card that
 * belongs to a different salon, even if they somehow learned its serial number.
 */
export async function findCardBySerialInSalon(
  prisma: PrismaClient,
  salonId: string,
  serialNumber: string,
): Promise<{ card: LoyaltyCard; salon: Salon } | null> {
  const card = await prisma.loyaltyCard.findUnique({ where: { serialNumber } });
  if (!card || card.salonId !== salonId) return null;

  const salon = await prisma.salon.findUniqueOrThrow({ where: { id: salonId } });
  return { card, salon };
}

export async function addStamp(
  prisma: PrismaClient,
  input: { loyaltyCardId: string; staffUserId: string },
): Promise<LoyaltyCard> {
  return prisma.$transaction(async (tx) => {
    await tx.stampEvent.create({
      data: { loyaltyCardId: input.loyaltyCardId, staffUserId: input.staffUserId },
    });
    return tx.loyaltyCard.update({
      where: { id: input.loyaltyCardId },
      data: { stampCount: { increment: 1 } },
    });
  });
}

export class RewardNotReadyError extends Error {
  constructor() {
    super('Loyalty card has not reached the required stamp count yet');
    this.name = 'RewardNotReadyError';
  }
}

/** Redeems the reward: resets the stamp count to 0. Throws if the card hasn't earned it yet. */
export async function redeemReward(
  prisma: PrismaClient,
  input: { loyaltyCardId: string; staffUserId: string; stampsRequired: number },
): Promise<LoyaltyCard> {
  return prisma.$transaction(async (tx) => {
    const card = await tx.loyaltyCard.findUniqueOrThrow({ where: { id: input.loyaltyCardId } });
    if (card.stampCount < input.stampsRequired) throw new RewardNotReadyError();

    await tx.redemption.create({
      data: { loyaltyCardId: input.loyaltyCardId, staffUserId: input.staffUserId },
    });
    return tx.loyaltyCard.update({
      where: { id: input.loyaltyCardId },
      data: { stampCount: 0 },
    });
  });
}
