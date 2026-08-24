export interface BillingPlan {
  id: string;
  name: string;
  priceEnvVar: string;
}

// Flat tiered subscriptions, not per-stamp billing (unpredictable costs for a small salon
// owner) -- see project notes on the pricing decision. Actual EUR amounts are set as Stripe
// Prices in the Stripe dashboard, not hardcoded here; this only maps a plan id to which env var
// holds that Price's id.
export const BILLING_PLANS: BillingPlan[] = [
  { id: 'starter', name: 'Starter', priceEnvVar: 'STRIPE_PRICE_STARTER' },
  { id: 'standard', name: 'Standard', priceEnvVar: 'STRIPE_PRICE_STANDARD' },
];

export function findBillingPlan(planId: string): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.id === planId);
}

/** Resolves a plan id to its configured Stripe Price id. Throws with a clear message if the
 * plan is unknown or its env var isn't set, rather than failing later with a confusing Stripe
 * API error. */
export function resolvePriceId(planId: string, env: NodeJS.ProcessEnv = process.env): string {
  const plan = findBillingPlan(planId);
  if (!plan) throw new Error(`Unknown billing plan "${planId}"`);

  const priceId = env[plan.priceEnvVar];
  if (!priceId) throw new Error(`${plan.priceEnvVar} is not set (see .env.example)`);
  return priceId;
}
