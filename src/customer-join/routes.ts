import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { renderJoinPage } from './joinPage';
import { createCustomerWithCard } from '../loyalty/customerRepository';
import { isAppleMobileDevice } from '../customer-pwa/deviceDetection';

export interface CustomerJoinRoutesOptions {
  prisma: PrismaClient;
}

interface JoinBody {
  name: string;
  phone?: string;
}

export function registerCustomerJoinRoutes(app: FastifyInstance, options: CustomerJoinRoutesOptions): void {
  const { prisma } = options;

  app.get<{ Params: { slug: string } }>('/salons/:slug/join', async (request, reply) => {
    const salon = await prisma.salon.findUnique({ where: { slug: request.params.slug } });
    if (!salon) return reply.code(404).send({ error: 'salon_not_found' });
    reply.type('text/html').send(renderJoinPage(salon.name, salon.slug));
  });

  app.post<{ Params: { slug: string }; Body: JoinBody }>(
    '/salons/:slug/join',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const salon = await prisma.salon.findUnique({ where: { slug: request.params.slug } });
      if (!salon) return reply.code(404).send({ error: 'salon_not_found' });

      const { loyaltyCard } = await createCustomerWithCard(prisma, {
        salonId: salon.id,
        name: request.body.name,
        phone: request.body.phone,
      });

      // iPhone has no Google Wallet app to save into (see customer-pwa/deviceDetection.ts) --
      // send it straight to the PWA card page instead of a dead-end Google save link. Every
      // other device skips the intermediate page and goes directly into the real "Add to
      // Google Wallet" flow, one fewer tap right after typing your name on a shared shop device.
      const walletUrl = `/wallet/${encodeURIComponent(loyaltyCard.serialNumber)}`;
      const redirectUrl = isAppleMobileDevice(request.headers['user-agent'])
        ? walletUrl
        : `${walletUrl}/google-save-link`;

      return reply.code(201).send({ serialNumber: loyaltyCard.serialNumber, redirectUrl });
    },
  );
}
