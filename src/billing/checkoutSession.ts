import type Stripe from 'stripe';

export interface CreateCheckoutSessionInput {
  priceId: string;
  salonId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** If the salon already has a Stripe customer (e.g. from a past checkout), reuse it instead
   * of asking Stripe to create a new one from customerEmail. */
  existingStripeCustomerId?: string | null;
}

export async function createCheckoutSession(
  stripe: Stripe,
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.salonId,
    metadata: { salonId: input.salonId },
    ...(input.existingStripeCustomerId
      ? { customer: input.existingStripeCustomerId }
      : { customer_email: input.customerEmail }),
  });
}
