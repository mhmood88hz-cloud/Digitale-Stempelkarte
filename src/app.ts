import Fastify, { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { attachSession } from './auth/tenantGuard';
import { registerAuthRoutes } from './auth/routes';

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

  return app;
}
