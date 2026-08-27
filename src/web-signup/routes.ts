import type { FastifyInstance } from 'fastify';
import { renderSignupPage } from './signupPage';

export function registerWebSignupRoutes(app: FastifyInstance): void {
  app.get('/signup', async (_request, reply) => {
    reply.type('text/html').send(renderSignupPage());
  });
}
