import type { Customer, LoyaltyCard, PrismaClient } from '@prisma/client';
import { generateSerialNumber } from './serial';

export interface CreateCustomerInput {
  salonId: string;
  name: string;
  email?: string;
  phone?: string;
}

/** Creates a customer together with their loyalty card (one card per customer for the MVP). */
export async function createCustomerWithCard(
  prisma: PrismaClient,
  input: CreateCustomerInput,
): Promise<{ customer: Customer; loyaltyCard: LoyaltyCard }> {
  const customer = await prisma.customer.create({
    data: {
      salonId: input.salonId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      loyaltyCards: {
        create: {
          salonId: input.salonId,
          serialNumber: generateSerialNumber(),
        },
      },
    },
    include: { loyaltyCards: true },
  });
  return { customer, loyaltyCard: customer.loyaltyCards[0] };
}

export interface CustomerListEntry {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyCardId: string;
  serialNumber: string;
  stampCount: number;
  walletMode: string;
  hasPushSubscription: boolean;
}

/** Lists a salon's customers with their card summary, newest first. */
export async function listCustomersForSalon(prisma: PrismaClient, salonId: string): Promise<CustomerListEntry[]> {
  const customers = await prisma.customer.findMany({
    where: { salonId },
    orderBy: { createdAt: 'desc' },
    include: { loyaltyCards: { include: { pushSubscriptions: true } } },
  });

  return customers.flatMap((customer) =>
    customer.loyaltyCards.map((card) => ({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      loyaltyCardId: card.id,
      serialNumber: card.serialNumber,
      stampCount: card.stampCount,
      walletMode: card.walletMode,
      hasPushSubscription: card.pushSubscriptions.length > 0,
    })),
  );
}
