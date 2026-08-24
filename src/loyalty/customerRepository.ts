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
