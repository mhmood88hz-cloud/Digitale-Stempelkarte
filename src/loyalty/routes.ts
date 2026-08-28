import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { LoyaltyCard, PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth/tenantGuard';
import { createCustomerWithCard, listCustomersForSalon } from './customerRepository';
import { addStamp, findCardBySerialInSalon, redeemReward, RewardNotReadyError } from './stampRepository';
import { loadGoogleWalletCredentials } from '../googlewallet/credentials';
import { pushLoyaltyObjectUpdate } from '../googlewallet/updateObject';

/**
 * Pushes the new stamp count to Google Wallet if this card has one (walletMode: 'google').
 * Deliberately non-fatal: a saved Google Wallet card not refreshing immediately is worse UX
 * than ideal, but failing the whole stamp/redemption request over a third-party API hiccup
 * would be worse -- the database stamp count (checked by staff via /staff/scan) is the source
 * of truth regardless.
 */
async function pushGoogleWalletUpdateIfNeeded(
  card: LoyaltyCard,
  stampsRequired: number,
  log: FastifyBaseLogger,
): Promise<void> {
  if (card.walletMode !== 'google' || !card.googleObjectId) return;
  try {
    const credentials = loadGoogleWalletCredentials();
    await pushLoyaltyObjectUpdate(credentials, card.googleObjectId, {
      stampCount: card.stampCount,
      stampsRequired,
    });
  } catch (err) {
    log.warn({ err, loyaltyCardId: card.id }, 'Google Wallet object update failed');
  }
}

export interface LoyaltyRoutesOptions {
  prisma: PrismaClient;
}

interface CreateCustomerBody {
  name: string;
  email?: string;
  phone?: string;
}

interface SerialBody {
  serialNumber: string;
}

export function registerLoyaltyRoutes(app: FastifyInstance, options: LoyaltyRoutesOptions): void {
  const { prisma } = options;

  app.post<{ Body: CreateCustomerBody }>(
    '/api/customers',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            email: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, email, phone } = request.body;
      const { customer, loyaltyCard } = await createCustomerWithCard(prisma, {
        salonId: request.session!.salonId,
        name,
        email,
        phone,
      });
      return reply.code(201).send({
        customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
        loyaltyCard: { id: loyaltyCard.id, serialNumber: loyaltyCard.serialNumber, stampCount: loyaltyCard.stampCount },
      });
    },
  );

  app.get('/api/customers', { preHandler: requireAuth }, async (request) => {
    return listCustomersForSalon(prisma, request.session!.salonId);
  });

  app.post<{ Body: SerialBody }>(
    '/api/stamps',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['serialNumber'],
          properties: { serialNumber: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const session = request.session!;
      const found = await findCardBySerialInSalon(prisma, session.salonId, request.body.serialNumber);
      if (!found) return reply.code(404).send({ error: 'card_not_found' });

      const updated = await addStamp(prisma, { loyaltyCardId: found.card.id, staffUserId: session.staffUserId });
      await pushGoogleWalletUpdateIfNeeded(updated, found.salon.stampsRequired, request.log);
      return reply.send({
        stampCount: updated.stampCount,
        stampsRequired: found.salon.stampsRequired,
        rewardReady: updated.stampCount >= found.salon.stampsRequired,
      });
    },
  );

  app.post<{ Body: SerialBody }>(
    '/api/redemptions',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['serialNumber'],
          properties: { serialNumber: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const session = request.session!;
      const found = await findCardBySerialInSalon(prisma, session.salonId, request.body.serialNumber);
      if (!found) return reply.code(404).send({ error: 'card_not_found' });

      try {
        const updated = await redeemReward(prisma, {
          loyaltyCardId: found.card.id,
          staffUserId: session.staffUserId,
          stampsRequired: found.salon.stampsRequired,
        });
        await pushGoogleWalletUpdateIfNeeded(updated, found.salon.stampsRequired, request.log);
        return reply.send({ stampCount: updated.stampCount });
      } catch (err) {
        if (err instanceof RewardNotReadyError) {
          return reply.code(409).send({ error: 'reward_not_ready' });
        }
        throw err;
      }
    },
  );
}
