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

/** Customer count above which a salon is billed 'standard' instead of 'starter'. Chosen by the
 * salon's current customer count, not a manual choice at checkout -- see the checkout route. */
export const STANDARD_TIER_CUSTOMER_THRESHOLD = 100;

/**
 * Picks the plan id for a salon based on how many customers it currently has. Deliberately
 * evaluated only at checkout time, not kept in sync afterwards -- a salon that grows past the
 * threshold mid-subscription keeps its current price until it resubscribes/upgrades. Automatic
 * mid-cycle upgrades would need a scheduled job calling Stripe's subscription-update API; out of
 * scope for now, tracked as a deliberate follow-up rather than silently missing.
 */
export function planIdForCustomerCount(customerCount: number): string {
  return customerCount > STANDARD_TIER_CUSTOMER_THRESHOLD ? 'standard' : 'starter';
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
