import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';
import type { VapidConfig } from './vapidConfig';
import { deleteSubscriptionByEndpoint } from './subscriptionRepository';

export interface DueReminderCard {
  loyaltyCardId: string;
  serialNumber: string;
  subscriptions: { endpoint: string; p256dhKey: string; authKey: string }[];
}

/** Finds cards whose customer has a push subscription, hasn't stamped in `intervalDays`, and
 * hasn't already been reminded within that same window (so a reminder job that runs daily
 * doesn't re-notify the same customer every single day). */
export async function findCardsDueForReminder(
  prisma: PrismaClient,
  salonId: string,
  intervalDays: number,
): Promise<DueReminderCard[]> {
  const cutoff = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000);

  const cards = await prisma.loyaltyCard.findMany({
    where: {
      salonId,
      pushSubscriptions: { some: {} },
      OR: [{ lastReminderSentAt: null }, { lastReminderSentAt: { lt: cutoff } }],
    },
    include: {
      pushSubscriptions: true,
      stampEvents: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return cards
    .filter((card) => {
      const lastActivity = card.stampEvents[0]?.createdAt ?? card.createdAt;
      return lastActivity < cutoff;
    })
    .map((card) => ({
      loyaltyCardId: card.id,
      serialNumber: card.serialNumber,
      subscriptions: card.pushSubscriptions.map((s) => ({
        endpoint: s.endpoint,
        p256dhKey: s.p256dhKey,
        authKey: s.authKey,
      })),
    }));
}

export interface PushSendResult {
  ok: boolean;
  /** True when the push service reported the subscription is gone (404/410) -- the caller
   * should delete it, retrying forever against a dead endpoint helps no one. */
  shouldDelete: boolean;
}

export async function sendPushNotification(
  vapid: VapidConfig,
  subscription: { endpoint: string; p256dhKey: string; authKey: string },
  payload: { title: string; body: string; url: string },
): Promise<PushSendResult> {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey } },
      JSON.stringify(payload),
    );
    return { ok: true, shouldDelete: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return { ok: false, shouldDelete: statusCode === 404 || statusCode === 410 };
  }
}

export interface SalonForReminders {
  id: string;
  name: string;
  reminderIntervalDays: number | null;
}

/** Sends a "come back" reminder to every due customer of a salon. No-op if the salon hasn't
 * opted in (reminderIntervalDays is null). Returns how many customers were actually notified
 * (at least one of their subscriptions succeeded). */
export async function sendRemindersForSalon(
  prisma: PrismaClient,
  vapid: VapidConfig,
  salon: SalonForReminders,
): Promise<{ sent: number }> {
  if (!salon.reminderIntervalDays) return { sent: 0 };

  const due = await findCardsDueForReminder(prisma, salon.id, salon.reminderIntervalDays);
  let sent = 0;

  for (const card of due) {
    let anySucceeded = false;
    for (const subscription of card.subscriptions) {
      const result = await sendPushNotification(vapid, subscription, {
        title: salon.name,
        body: 'Wir vermissen dich! Komm doch mal wieder vorbei und hol dir deinen Stempel.',
        url: `/wallet/${card.serialNumber}`,
      });
      if (result.shouldDelete) await deleteSubscriptionByEndpoint(prisma, subscription.endpoint);
      if (result.ok) anySucceeded = true;
    }
    if (anySucceeded) {
      sent += 1;
      await prisma.loyaltyCard.update({
        where: { id: card.loyaltyCardId },
        data: { lastReminderSentAt: new Date() },
      });
    }
  }

  return { sent };
}
