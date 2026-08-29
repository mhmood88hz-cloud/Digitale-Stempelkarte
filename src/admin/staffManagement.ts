import type { PrismaClient, StaffUser } from '@prisma/client';

export class LastOwnerError extends Error {
  constructor() {
    super('Cannot remove the last owner of a salon');
    this.name = 'LastOwnerError';
  }
}

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`Email "${email}" is already used by another staff member of this salon`);
    this.name = 'EmailTakenError';
  }
}

export class StaffNotFoundError extends Error {
  constructor() {
    super('Staff member not found in this salon');
    this.name = 'StaffNotFoundError';
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

export async function listStaff(prisma: PrismaClient, salonId: string): Promise<StaffUser[]> {
  return prisma.staffUser.findMany({ where: { salonId }, orderBy: { createdAt: 'asc' } });
}

function startOfTodayUtc(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** How many stamps each staff member of a salon has given today (UTC calendar day) -- lets the
 * owner spot-check who scanned how many customers at the end of the day. Keyed by staffUserId;
 * a staff member with zero stamps today simply has no entry. */
export async function getStaffStampCountsToday(
  prisma: PrismaClient,
  salonId: string,
  now: Date = new Date(),
): Promise<Record<string, number>> {
  const { start, end } = startOfTodayUtc(now);
  const grouped = await prisma.stampEvent.groupBy({
    by: ['staffUserId'],
    where: { createdAt: { gte: start, lt: end }, staffUser: { salonId } },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const group of grouped) counts[group.staffUserId] = group._count._all;
  return counts;
}

export async function addStaff(
  prisma: PrismaClient,
  input: { salonId: string; email: string; passwordHash: string; role: 'owner' | 'staff' },
): Promise<StaffUser> {
  try {
    return await prisma.staffUser.create({
      data: { salonId: input.salonId, email: input.email, passwordHash: input.passwordHash, role: input.role },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new EmailTakenError(input.email);
    throw err;
  }
}

/** Removes a staff member, refusing to remove the salon's last remaining owner. */
export async function removeStaff(prisma: PrismaClient, salonId: string, staffUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.staffUser.findFirst({ where: { id: staffUserId, salonId } });
    if (!target) throw new StaffNotFoundError();

    if (target.role === 'owner') {
      const ownerCount = await tx.staffUser.count({ where: { salonId, role: 'owner' } });
      if (ownerCount <= 1) throw new LastOwnerError();
    }

    await tx.staffUser.delete({ where: { id: staffUserId } });
  });
}
