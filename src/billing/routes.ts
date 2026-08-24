import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireOwner } from '../auth/tenantGuard';
import { getSalon } from '../admin/salonRepository';
import { resolvePriceId } from './plans';
import { loadStripeClient } from './stripeClient';
import { createCheckoutSession } from './checkoutSession';
import { verifyWebhookEvent, handleWebhookEvent } from './webhookHandler';

export interface BillingRoutesOptions {
  prisma: PrismaClient;
}

interface CheckoutBody {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export function registerBillingRoutes(app: FastifyInstance, options: BillingRoutesOptions): void {
  const { prisma } = options;

  app.post<{ Body: CheckoutBody }>(
    '/api/billing/checkout',
    {
      preHandler: requireOwner,
      schema: {
        body: {
          type: 'object',
          required: ['planId', 'successUrl', 'cancelUrl'],
          properties: {
            planId: { type: 'string', minLength: 1 },
            successUrl: { type: 'string', minLength: 1 },
            cancelUrl: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      let priceId: string;
      let stripe;
      try {
        priceId = resolvePriceId(request.body.planId);
        stripe = loadStripeClient();
      } catch {
        return reply.code(503).send({ error: 'billing_not_configured' });
      }

      const salon = await getSalon(prisma, request.session!.salonId);
      const staffUser = await prisma.staffUser.findUniqueOrThrow({ where: { id: request.session!.staffUserId } });

      const session = await createCheckoutSession(stripe, {
        priceId,
        salonId: salon.id,
        customerEmail: staffUser.email,
        successUrl: request.body.successUrl,
        cancelUrl: request.body.cancelUrl,
        existingStripeCustomerId: salon.stripeCustomerId,
      });

      return reply.send({ checkoutUrl: session.url });
    },
  );

  // Stripe's signature verification needs the exact raw request bytes, not Fastify's default
  // parsed-then-re-serialized JSON -- scoped to just this route via an encapsulated plugin so
  // it doesn't change body parsing anywhere else in the app.
  app.register(async (scoped) => {
    scoped.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    scoped.post('/api/billing/webhook', async (request, reply) => {
      let stripe;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      try {
        stripe = loadStripeClient();
        if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set (see .env.example)');
      } catch {
        return reply.code(503).send({ error: 'billing_not_configured' });
      }

      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        return reply.code(400).send({ error: 'missing_signature' });
      }

      let event;
      try {
        event = verifyWebhookEvent(stripe, request.body as Buffer, signature, webhookSecret);
      } catch {
        return reply.code(400).send({ error: 'invalid_signature' });
      }

      await handleWebhookEvent(prisma, event);
      return reply.send({ received: true });
    });
  });
}
