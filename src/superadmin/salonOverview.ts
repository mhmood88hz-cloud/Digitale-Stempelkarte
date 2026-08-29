import type { PrismaClient, Salon } from '@prisma/client';

export interface SalonOverview {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string;
  trialEndsAt: Date;
  customerCount: number;
}

export async function listAllSalons(prisma: PrismaClient): Promise<SalonOverview[]> {
  const salons = await prisma.salon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { customers: true } } },
  });
  return salons.map((salon) => ({
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    isActive: salon.isActive,
    subscriptionStatus: salon.subscriptionStatus,
    trialEndsAt: salon.trialEndsAt,
    customerCount: salon._count.customers,
  }));
}

export async function setSalonActive(prisma: PrismaClient, salonId: string, isActive: boolean): Promise<Salon> {
  return prisma.salon.update({ where: { id: salonId }, data: { isActive } });
}
