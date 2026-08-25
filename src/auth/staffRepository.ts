import type { PrismaClient, Salon, StaffUser } from '@prisma/client';

export interface CreateSalonWithOwnerInput {
  salonName: string;
  slug: string;
  ownerEmail: string;
  passwordHash: string;
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TRIAL_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days -- market-launch pilot period

/** Thrown when a salon slug is already taken (maps to Prisma's unique-constraint error P2002). */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Salon slug "${slug}" is already taken`);
    this.name = 'SlugTakenError';
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

/** Creates a salon together with its owner staff account in a single write. */
export async function createSalonWithOwner(
  prisma: PrismaClient,
  input: CreateSalonWithOwnerInput,
): Promise<{ salon: Salon; staffUser: StaffUser }> {
  try {
    const salon = await prisma.salon.create({
      data: {
        name: input.salonName,
        slug: input.slug,
        trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS),
        staffUsers: {
          create: {
            email: input.ownerEmail,
            passwordHash: input.passwordHash,
            role: 'owner',
          },
        },
      },
      include: { staffUsers: true },
    });
    return { salon, staffUser: salon.staffUsers[0] };
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new SlugTakenError(input.slug);
    throw err;
  }
}

/** Looks up a staff user for login, scoped to a salon by slug (staff emails are only unique per-salon). */
export async function findStaffForLogin(
  prisma: PrismaClient,
  slug: string,
  email: string,
): Promise<{ salon: Salon; staffUser: StaffUser } | null> {
  const salon = await prisma.salon.findUnique({
    where: { slug },
    include: { staffUsers: { where: { email } } },
  });
  if (!salon || salon.staffUsers.length === 0) return null;
  return { salon, staffUser: salon.staffUsers[0] };
}
