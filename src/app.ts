import Fastify, { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { attachSession } from './auth/tenantGuard';
import { registerAuthRoutes } from './auth/routes';
import { registerLoyaltyRoutes } from './loyalty/routes';
import { registerWebStaffRoutes } from './web-staff/routes';
import { registerCustomerPwaRoutes } from './customer-pwa/routes';
import { registerReportRoutes } from './reports/routes';
import { registerAdminRoutes } from './admin/routes';
import { registerWebAdminRoutes } from './web-admin/routes';
import { registerBillingRoutes } from './billing/routes';
import { registerWebLoginRoutes } from './web-login/routes';
import { registerWebSignupRoutes } from './web-signup/routes';

export interface BuildAppOptions {
  prisma: PrismaClient;
  sessionSecret: string;
  secureCookies?: boolean;
  /** Local-dev-only: serve over HTTPS with a self-signed cert (needed for camera access on a
   * phone over the LAN -- browsers require a secure context for getUserMedia, and that's not
   * satisfied by a plain http:// LAN address). Never used in production, see server.ts. */
  https?: { key: Buffer; cert: Buffer };
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  // Fastify's TS overloads resolve to a distinct (HTTPS/HTTP2-flavored) instance type when
  // `https` is present, which doesn't structurally match the plain-HTTP FastifyInstance this
  // function returns everywhere else -- this only affects local-dev tooling (see server.ts),
  // never production, so a cast here is simpler than threading a second return type through
  // every route module for one optional dev flag.
  const app = (options.https
    ? Fastify({ logger: true, https: options.https })
    : Fastify({ logger: true })) as FastifyInstance;

  app.addHook('preHandler', attachSession(options.sessionSecret));

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, options);
  registerLoyaltyRoutes(app, options);
  registerWebStaffRoutes(app);
  registerCustomerPwaRoutes(app, options);
  registerReportRoutes(app, options);
  registerAdminRoutes(app, options);
  registerWebAdminRoutes(app);
  registerBillingRoutes(app, options);
  registerWebLoginRoutes(app);
  registerWebSignupRoutes(app);

  return app;
}
