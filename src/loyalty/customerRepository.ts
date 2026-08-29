import type { Customer, LoyaltyCard, PrismaClient } from '@prisma/client';
import { generateSerialNumber } from './serial';

export interface CreateCustomerInput {
  salonId: string;
  name: string;
  email?: string;
  phone?: string;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

/** Creates a customer together with their loyalty card (one card per customer for the MVP).
 * Assigns the next short, per-salon customerNumber (1, 2, 3, ...) -- retries on a rare race
 * against another signup landing on the same number at the same instant. */
export async function createCustomerWithCard(
  prisma: PrismaClient,
  input: CreateCustomerInput,
): Promise<{ customer: Customer; loyaltyCard: LoyaltyCard }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.customer.findFirst({
      where: { salonId: input.salonId },
      orderBy: { customerNumber: 'desc' },
      select: { customerNumber: true },
    });
    const customerNumber = (last?.customerNumber ?? 0) + 1;

    try {
      const customer = await prisma.customer.create({
        data: {
          salonId: input.salonId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          customerNumber,
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
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error('Could not assign a customer number after several attempts');
}

export interface CustomerListEntry {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  customerNumber: number;
  loyaltyCardId: string;
  serialNumber: string;
  stampCount: number;
  walletMode: string;
  hasPushSubscription: boolean;
}

function toListEntries(
  customers: Array<
    Customer & { loyaltyCards: Array<LoyaltyCard & { pushSubscriptions: { id: string }[] }> }
  >,
): CustomerListEntry[] {
  return customers.flatMap((customer) =>
    customer.loyaltyCards.map((card) => ({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerNumber: customer.customerNumber,
      loyaltyCardId: card.id,
      serialNumber: card.serialNumber,
      stampCount: card.stampCount,
      walletMode: card.walletMode,
      hasPushSubscription: card.pushSubscriptions.length > 0,
    })),
  );
}

/** Lists a salon's customers with their card summary, newest first. */
export async function listCustomersForSalon(prisma: PrismaClient, salonId: string): Promise<CustomerListEntry[]> {
  const customers = await prisma.customer.findMany({
    where: { salonId },
    orderBy: { createdAt: 'desc' },
    include: { loyaltyCards: { include: { pushSubscriptions: true } } },
  });
  return toListEntries(customers);
}

/**
 * Staff-facing search used on the scan page so a customer can be found and stamped without a
 * serial number/QR at all -- by name, phone, or their short customerNumber. Requires at least 2
 * characters to avoid pulling the whole customer list on every keystroke -- except a pure
 * customerNumber query, which is exempt (customer numbers start at 1, so a real single-digit
 * search must still work).
 */
export async function searchCustomersForSalon(
  prisma: PrismaClient,
  salonId: string,
  query: string,
): Promise<CustomerListEntry[]> {
  const trimmed = query.trim();
  const asNumber = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  if (trimmed.length < 2 && asNumber === null) return [];

  const customers = await prisma.customer.findMany({
    where: {
      salonId,
      OR: [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { phone: { contains: trimmed } },
        ...(asNumber !== null ? [{ customerNumber: asNumber }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { loyaltyCards: { include: { pushSubscriptions: true } } },
  });
  return toListEntries(customers);
}

export interface SelfLookupInput {
  customerNumber?: number;
  name?: string;
  phone?: string;
}

/**
 * Public, unauthenticated self-service lookup (see src/customer-join) so a returning customer
 * can find their own card by something they can remember, without ever having saved a link.
 * Deliberately narrow: an exact customerNumber match, or an exact name+phone match together --
 * name alone is never enough (ambiguous, and would let a stranger browse other customers'
 * stamp counts by guessing common names). Returns null on no match or more than one match.
 */
export async function findCustomerForSelfLookup(
  prisma: PrismaClient,
  salonId: string,
  input: SelfLookupInput,
): Promise<CustomerListEntry | null> {
  const where =
    input.customerNumber !== undefined
      ? { salonId, customerNumber: input.customerNumber }
      : input.name && input.phone
        ? { salonId, name: { equals: input.name, mode: 'insensitive' as const }, phone: input.phone }
        : null;
  if (!where) return null;

  const customers = await prisma.customer.findMany({
    where,
    include: { loyaltyCards: { include: { pushSubscriptions: true } } },
  });
  if (customers.length !== 1) return null;

  const [entry] = toListEntries(customers);
  return entry ?? null;
}
