import type { Customer, LoyaltyCard, PrismaClient, Salon } from '@prisma/client';

/**
 * Public, customer-facing lookup: NOT scoped by a staff session, because there isn't one --
 * the customer opens this link directly. The serial number itself is the access control (a
 * long random bearer token, see src/loyalty/serial.ts), same as a boarding-pass link.
 */
export async function findCardForDisplay(
  prisma: PrismaClient,
  serialNumber: string,
): Promise<{ card: LoyaltyCard; salon: Salon; customer: Customer } | null> {
  const card = await prisma.loyaltyCard.findUnique({ where: { serialNumber } });
  if (!card) return null;
  const [salon, customer] = await Promise.all([
    prisma.salon.findUniqueOrThrow({ where: { id: card.salonId } }),
    prisma.customer.findUniqueOrThrow({ where: { id: card.customerId } }),
  ]);
  return { card, salon, customer };
}
