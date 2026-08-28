import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireOwner } from '../auth/tenantGuard';
import { findCardForDisplay } from '../customer-pwa/cardRepository';
import { getSalon } from '../admin/salonRepository';
import { loadVapidConfig } from './vapidConfig';
import { saveSubscription } from './subscriptionRepository';
import { sendManualReminder, sendRemindersForSalon } from './reminders';

export interface PushRoutesOptions {
  prisma: PrismaClient;
}

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function registerPushRoutes(app: FastifyInstance, options: PushRoutesOptions): void {
  const { prisma } = options;

  app.get('/push/vapid-public-key', async (_request, reply) => {
    try {
      const { publicKey } = loadVapidConfig();
      return reply.send({ publicKey });
    } catch {
      return reply.code(503).send({ error: 'push_not_configured' });
    }
  });

  app.post<{ Params: { serialNumber: string }; Body: SubscribeBody }>(
    '/wallet/:serialNumber/push-subscribe',
    {
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: { type: 'string', minLength: 1 },
            keys: {
              type: 'object',
              required: ['p256dh', 'auth'],
              properties: { p256dh: { type: 'string', minLength: 1 }, auth: { type: 'string', minLength: 1 } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const found = await findCardForDisplay(prisma, request.params.serialNumber);
      if (!found) return reply.code(404).send({ error: 'card_not_found' });

      await saveSubscription(prisma, {
        loyaltyCardId: found.card.id,
        endpoint: request.body.endpoint,
        p256dhKey: request.body.keys.p256dh,
        authKey: request.body.keys.auth,
      });
      return reply.code(201).send({ ok: true });
    },
  );

  app.post('/api/reminders/send', { preHandler: requireOwner }, async (request, reply) => {
    let vapid;
    try {
      vapid = loadVapidConfig();
    } catch {
      return reply.code(503).send({ error: 'push_not_configured' });
    }

    const salon = await getSalon(prisma, request.session!.salonId);
    const result = await sendRemindersForSalon(prisma, vapid, {
      id: salon.id,
      name: salon.name,
      reminderIntervalDays: salon.reminderIntervalDays,
    });
    return reply.send(result);
  });

  app.post<{ Params: { serialNumber: string } }>(
    '/api/customers/:serialNumber/remind',
    { preHandler: requireAuth },
    async (request, reply) => {
      let vapid;
      try {
        vapid = loadVapidConfig();
      } catch {
        return reply.code(503).send({ error: 'push_not_configured' });
      }

      const salon = await getSalon(prisma, request.session!.salonId);
      const result = await sendManualReminder(prisma, vapid, salon, request.params.serialNumber);

      if (result.status === 'no_subscription') return reply.code(404).send({ error: 'no_subscription' });
      if (result.status === 'send_failed') return reply.code(502).send({ error: 'send_failed' });
      return reply.send({ ok: true });
    },
  );
}
