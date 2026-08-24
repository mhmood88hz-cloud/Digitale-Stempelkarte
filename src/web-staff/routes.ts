import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/tenantGuard';
import { renderScanPage } from './scanPage';

export function registerWebStaffRoutes(app: FastifyInstance): void {
  app.get('/staff/scan', { preHandler: requireAuth }, async (_request, reply) => {
    reply.type('text/html').send(renderScanPage());
  });
}
