import type { PrismaClient, PushSubscription } from '@prisma/client';

export interface SaveSubscriptionInput {
  loyaltyCardId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

/** Upserts by endpoint: a customer re-subscribing (e.g. after clearing site data) just updates
 * the existing row instead of accumulating duplicate, possibly-stale subscriptions. */
export async function saveSubscription(
  prisma: PrismaClient,
  input: SaveSubscriptionInput,
): Promise<PushSubscription> {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: input,
    update: { loyaltyCardId: input.loyaltyCardId, p256dhKey: input.p256dhKey, authKey: input.authKey },
  });
}

/** Removes a subscription that a push send reported as gone (410 Gone / 404) -- keeping dead
 * endpoints around would just make every future reminder run retry them forever. */
export async function deleteSubscriptionByEndpoint(prisma: PrismaClient, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
