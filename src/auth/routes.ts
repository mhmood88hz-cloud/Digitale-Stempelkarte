import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './password';
import { createSessionToken } from './session';
import { buildClearCookieHeader, buildSetCookieHeader, requireAuth } from './tenantGuard';
import { createSalonWithOwner, findStaffForLogin, SlugTakenError, SLUG_PATTERN } from './staffRepository';

export interface AuthRoutesOptions {
  prisma: PrismaClient;
  sessionSecret: string;
  secureCookies?: boolean;
}

interface SignupBody {
  salonName: string;
  slug: string;
  ownerEmail: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface LoginParams {
  slug: string;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  const { prisma, sessionSecret, secureCookies = false } = options;

  app.post<{ Body: SignupBody }>(
    '/auth/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['salonName', 'slug', 'ownerEmail', 'password'],
          properties: {
            salonName: { type: 'string', minLength: 1 },
            slug: { type: 'string', minLength: 1 },
            ownerEmail: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const { salonName, slug, ownerEmail, password } = request.body;
      if (!SLUG_PATTERN.test(slug)) {
        return reply.code(400).send({ error: 'invalid_slug' });
      }

      const passwordHash = await hashPassword(password);
      try {
        const { salon, staffUser } = await createSalonWithOwner(prisma, {
          salonName,
          slug,
          ownerEmail,
          passwordHash,
        });
        const token = createSessionToken(
          { staffUserId: staffUser.id, salonId: salon.id, role: staffUser.role },
          sessionSecret,
        );
        reply.header('set-cookie', buildSetCookieHeader(token, { secure: secureCookies }));
        return reply.code(201).send({
          salon: { id: salon.id, name: salon.name, slug: salon.slug },
          staffUser: { id: staffUser.id, email: staffUser.email, role: staffUser.role },
        });
      } catch (err) {
        if (err instanceof SlugTakenError) {
          return reply.code(409).send({ error: 'slug_taken' });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: LoginParams; Body: LoginBody }>(
    '/salons/:slug/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { email, password } = request.body;

      const result = await findStaffForLogin(prisma, slug, email);
      if (!result || !(await verifyPassword(password, result.staffUser.passwordHash))) {
        return reply.code(401).send({ error: 'invalid_credentials' });
      }

      const { salon, staffUser } = result;
      const token = createSessionToken(
        { staffUserId: staffUser.id, salonId: salon.id, role: staffUser.role },
        sessionSecret,
      );
      reply.header('set-cookie', buildSetCookieHeader(token, { secure: secureCookies }));
      return reply.send({
        salon: { id: salon.id, name: salon.name, slug: salon.slug },
        staffUser: { id: staffUser.id, email: staffUser.email, role: staffUser.role },
      });
    },
  );

  app.post('/auth/logout', async (_request, reply) => {
    reply.header('set-cookie', buildClearCookieHeader(secureCookies));
    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => request.session);
}
