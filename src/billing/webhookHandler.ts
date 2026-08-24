import type Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';

/** Verifies a webhook's Stripe-Signature header against the raw request body. Throws if it
 * doesn't match -- callers must reject the request (400), never process an unverified payload. */
export function verifyWebhookEvent(
  stripe: Stripe,
  payload: Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

function extractSalonId(session: Stripe.Checkout.Session): string | null {
  return session.client_reference_id ?? (typeof session.metadata?.salonId === 'string' ? session.metadata.salonId : null);
}

function extractId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/** Applies a verified webhook event's effect to our own data -- the only two events that change
 * a salon's subscription status for now (activation, cancellation). Unknown event types are
 * ignored (Stripe sends far more event types than we act on). */
export async function handleWebhookEvent(prisma: PrismaClient, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const salonId = extractSalonId(session);
      if (!salonId) return;

      await prisma.salon.update({
        where: { id: salonId },
        data: {
          subscriptionStatus: 'active',
          stripeCustomerId: extractId(session.customer),
          stripeSubscriptionId: extractId(session.subscription),
        },
      });
      return;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.salon.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { subscriptionStatus: 'canceled' },
      });
      return;
    }
    default:
      return;
  }
}
