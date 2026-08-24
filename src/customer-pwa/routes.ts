import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { findCardForDisplay } from './cardRepository';
import { renderWalletPage } from './page';
import { buildManifest } from './manifest';

export interface CustomerPwaRoutesOptions {
  prisma: PrismaClient;
}

const SERVICE_WORKER_SOURCE = `self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
`;

export function registerCustomerPwaRoutes(app: FastifyInstance, options: CustomerPwaRoutesOptions): void {
  const { prisma } = options;

  app.get<{ Params: { serialNumber: string } }>('/wallet/:serialNumber', async (request, reply) => {
    const found = await findCardForDisplay(prisma, request.params.serialNumber);
    if (!found) return reply.code(404).send({ error: 'card_not_found' });

    const { card, salon } = found;
    reply.type('text/html').send(
      renderWalletPage({
        salonName: salon.name,
        brandColor: salon.brandColor,
        stampCount: card.stampCount,
        stampsRequired: salon.stampsRequired,
        rewardReady: card.stampCount >= salon.stampsRequired,
        rewardDescription: salon.rewardDescription,
        serialNumber: card.serialNumber,
      }),
    );
  });

  app.get<{ Params: { serialNumber: string } }>(
    '/wallet/:serialNumber/manifest.webmanifest',
    async (request, reply) => {
      const found = await findCardForDisplay(prisma, request.params.serialNumber);
      if (!found) return reply.code(404).send({ error: 'card_not_found' });

      const { card, salon } = found;
      reply.type('application/manifest+json').send(
        buildManifest({
          salonName: salon.name,
          brandColor: salon.brandColor,
          serialNumber: card.serialNumber,
          logoUrl: salon.logoUrl,
        }),
      );
    },
  );

  app.get('/wallet/sw.js', async (_request, reply) => {
    reply.type('application/javascript').send(SERVICE_WORKER_SOURCE);
  });
}
