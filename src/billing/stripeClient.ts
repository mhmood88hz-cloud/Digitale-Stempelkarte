import Stripe from 'stripe';

/** Reads STRIPE_SECRET_KEY from env. Throws with a clear message if it's not set. */
export function loadStripeClient(env: NodeJS.ProcessEnv = process.env): Stripe {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set (see .env.example)');
  return new Stripe(secretKey);
}
