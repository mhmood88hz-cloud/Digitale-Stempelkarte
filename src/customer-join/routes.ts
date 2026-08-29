import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { renderJoinPage } from './joinPage';
import { createCustomerWithCard, findCustomerForSelfLookup } from '../loyalty/customerRepository';
import { isAppleMobileDevice } from '../customer-pwa/deviceDetection';
import { isRateLimited } from './rateLimit';

export interface CustomerJoinRoutesOptions {
  prisma: PrismaClient;
}

interface JoinBody {
  name: string;
  phone?: string;
}

interface LookupBody {
  customerNumber?: number;
  name?: string;
  phone?: string;
}

// iPhone has no Google Wallet app to save into (see customer-pwa/deviceDetection.ts) -- send it
// straight to the PWA card page instead of a dead-end Google save link. Every other device skips
// the intermediate page and goes directly into the real "Add to Google Wallet" flow.
function buildRedirectUrl(serialNumber: string, userAgent: string | undefined): string {
  const walletUrl = `/wallet/${encodeURIComponent(serialNumber)}`;
  return isAppleMobileDevice(userAgent) ? walletUrl : `${walletUrl}/google-save-link`;
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

      return reply.code(201).send({
        serialNumber: loyaltyCard.serialNumber,
        redirectUrl: buildRedirectUrl(loyaltyCard.serialNumber, request.headers['user-agent']),
      });
    },
  );

  // Public self-service lookup for an already-registered customer scanning the same shop QR
  // code again -- lets them find their own card (and current stamp count) without ever having
  // saved a link, at the cost of a narrow, rate-limited unauthenticated read (see
  // findCustomerForSelfLookup for why an exact customerNumber or name+phone match is required).
  app.post<{ Params: { slug: string }; Body: LookupBody }>(
    '/salons/:slug/lookup',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            customerNumber: { type: 'integer', minimum: 1 },
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const rateLimitKey = `lookup:${request.params.slug}:${request.ip}`;
      if (isRateLimited(rateLimitKey, 20, 5 * 60 * 1000)) {
        return reply.code(429).send({ error: 'too_many_attempts' });
      }

      const salon = await prisma.salon.findUnique({ where: { slug: request.params.slug } });
      if (!salon) return reply.code(404).send({ error: 'salon_not_found' });

      const found = await findCustomerForSelfLookup(prisma, salon.id, request.body);
      if (!found) return reply.code(404).send({ error: 'not_found' });

      return reply.send({
        serialNumber: found.serialNumber,
        redirectUrl: `/wallet/${encodeURIComponent(found.serialNumber)}`,
      });
    },
  );
}
