import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/tenantGuard';
import { renderAdminPage } from './adminPage';

export function registerWebAdminRoutes(app: FastifyInstance): void {
  app.get('/admin', { preHandler: requireAuth }, async (_request, reply) => {
    reply.type('text/html').send(renderAdminPage());
  });
}
