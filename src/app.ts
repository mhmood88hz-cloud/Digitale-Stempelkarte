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

export interface BuildAppOptions {
  prisma: PrismaClient;
  sessionSecret: string;
  secureCookies?: boolean;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  app.addHook('preHandler', attachSession(options.sessionSecret));

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, options);
  registerLoyaltyRoutes(app, options);
  registerWebStaffRoutes(app);
  registerCustomerPwaRoutes(app, options);
  registerReportRoutes(app, options);
  registerAdminRoutes(app, options);
  registerWebAdminRoutes(app);

  return app;
}
