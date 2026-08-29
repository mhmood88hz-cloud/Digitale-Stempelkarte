import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../auth/password';
import { buildSuperadminClearCookie, buildSuperadminSetCookie, createSuperadminToken } from './session';
import { requireSuperadmin } from './guard';
import { listAllSalons, setSalonActive } from './salonOverview';
import { renderSuperadminPage } from './page';

export interface SuperadminRoutesOptions {
  prisma: PrismaClient;
  sessionSecret: string;
  secureCookies?: boolean;
}

interface LoginBody {
  password: string;
}

interface SetActiveBody {
  isActive: boolean;
}

export function registerSuperadminRoutes(app: FastifyInstance, options: SuperadminRoutesOptions): void {
  const { prisma, sessionSecret, secureCookies = false } = options;

  app.get('/superadmin', async (_request, reply) => {
    reply.type('text/html').send(renderSuperadminPage());
  });

  app.post<{ Body: LoginBody }>(
    '/superadmin/login',
    { schema: { body: { type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 1 } } } } },
    async (request, reply) => {
      const passwordHash = process.env.SUPERADMIN_PASSWORD_HASH;
      if (!passwordHash) return reply.code(503).send({ error: 'superadmin_not_configured' });

      const valid = await verifyPassword(request.body.password, passwordHash);
      if (!valid) return reply.code(401).send({ error: 'invalid_credentials' });

      const token = createSuperadminToken(sessionSecret);
      reply.header('set-cookie', buildSuperadminSetCookie(token, secureCookies));
      return reply.send({ ok: true });
    },
  );

  app.post('/superadmin/logout', async (_request, reply) => {
    reply.header('set-cookie', buildSuperadminClearCookie(secureCookies));
    return reply.send({ ok: true });
  });

  app.get('/api/superadmin/salons', { preHandler: requireSuperadmin(sessionSecret) }, async () => {
    return listAllSalons(prisma);
  });

  app.patch<{ Params: { id: string }; Body: SetActiveBody }>(
    '/api/superadmin/salons/:id',
    {
      preHandler: requireSuperadmin(sessionSecret),
      schema: { body: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } } },
    },
    async (request) => {
      const salon = await setSalonActive(prisma, request.params.id, request.body.isActive);
      return { id: salon.id, isActive: salon.isActive };
    },
  );
}
