import type { PrismaClient } from '@prisma/client';
import type { MonthRange } from './monthRange';

export interface MonthlyReport {
  periodStart: string;
  periodEnd: string;
  newCustomers: number;
  stampsIssued: number;
  redemptions: number;
}

export async function buildMonthlyReport(
  prisma: PrismaClient,
  salonId: string,
  range: MonthRange,
): Promise<MonthlyReport> {
  const createdAt = { gte: range.start, lt: range.end };

  const [newCustomers, stampsIssued, redemptions] = await Promise.all([
    prisma.customer.count({ where: { salonId, createdAt } }),
    prisma.stampEvent.count({ where: { loyaltyCard: { salonId }, createdAt } }),
    prisma.redemption.count({ where: { loyaltyCard: { salonId }, redeemedAt: createdAt } }),
  ]);

  return {
    periodStart: range.start.toISOString(),
    periodEnd: range.end.toISOString(),
    newCustomers,
    stampsIssued,
    redemptions,
  };
}
