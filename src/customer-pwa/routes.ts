import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { findCardForDisplay } from './cardRepository';
import { renderWalletPage } from './page';
import { buildManifest } from './manifest';
import { loadGoogleWalletCredentials } from '../googlewallet/credentials';
import { buildSaveLink } from '../googlewallet/saveLink';
import { DEFAULT_PROGRAM_LOGO_URL, buildLoyaltyObjectId } from '../googlewallet/loyaltyObject';
import { isAppleMobileDevice } from './deviceDetection';

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
        showGoogleWalletLink: !isAppleMobileDevice(request.headers['user-agent']),
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

  app.get<{ Params: { serialNumber: string } }>('/wallet/:serialNumber/google-save-link', async (request, reply) => {
    const found = await findCardForDisplay(prisma, request.params.serialNumber);
    if (!found) return reply.code(404).send({ error: 'card_not_found' });

    let credentials;
    try {
      credentials = loadGoogleWalletCredentials();
    } catch {
      return reply.code(503).send({ error: 'google_wallet_not_configured' });
    }

    const { card, salon } = found;
    const link = buildSaveLink({
      issuerId: credentials.issuerId,
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKeyPem: credentials.privateKeyPem,
      classSuffix: salon.slug,
      serialNumber: card.serialNumber,
      salonName: salon.name,
      stampCount: card.stampCount,
      stampsRequired: salon.stampsRequired,
      hexBackgroundColor: salon.brandColor,
      programLogoUrl: salon.logoUrl ?? DEFAULT_PROGRAM_LOGO_URL,
      location:
        salon.locationLat !== null && salon.locationLng !== null
          ? { lat: salon.locationLat, lng: salon.locationLng }
          : undefined,
    });

    // Optimistic: we have no server-to-server callback from Google when the customer actually
    // taps "Add" in their browser, so we record intent to use Google Wallet at redirect time.
    // A later stamp push (see loyalty/routes.ts) against an object that was never actually
    // saved just fails harmlessly and is caught/logged there, not treated as a hard error.
    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        walletMode: 'google',
        googleObjectId: buildLoyaltyObjectId(credentials.issuerId, card.serialNumber),
      },
    });

    return reply.redirect(link, 302);
  });
}
