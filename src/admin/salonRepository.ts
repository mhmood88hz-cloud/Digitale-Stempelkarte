import type { PrismaClient, Salon } from '@prisma/client';

export interface SalonSettingsPatch {
  name?: string;
  brandColor?: string;
  stampsRequired?: number;
  rewardDescription?: string;
  logoUrl?: string;
}

export async function getSalon(prisma: PrismaClient, salonId: string): Promise<Salon> {
  return prisma.salon.findUniqueOrThrow({ where: { id: salonId } });
}

export async function updateSalonSettings(
  prisma: PrismaClient,
  salonId: string,
  patch: SalonSettingsPatch,
): Promise<Salon> {
  return prisma.salon.update({ where: { id: salonId }, data: patch });
}
