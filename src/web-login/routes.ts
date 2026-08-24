import type { FastifyInstance } from 'fastify';
import { renderLoginPage } from './loginPage';

export function registerWebLoginRoutes(app: FastifyInstance): void {
  app.get<{ Params: { slug: string } }>('/salons/:slug/login', async (request, reply) => {
    reply.type('text/html').send(renderLoginPage(request.params.slug));
  });
}
