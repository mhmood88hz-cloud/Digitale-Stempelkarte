import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireOwner } from '../auth/tenantGuard';
import { hashPassword } from '../auth/password';
import { getSalon, updateSalonSettings, type SalonSettingsPatch } from './salonRepository';
import {
  addStaff,
  EmailTakenError,
  LastOwnerError,
  listStaff,
  removeStaff,
  StaffNotFoundError,
} from './staffManagement';

export interface AdminRoutesOptions {
  prisma: PrismaClient;
}

interface AddStaffBody {
  email: string;
  password: string;
  role?: 'owner' | 'staff';
}

export function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions): void {
  const { prisma } = options;

  app.get('/api/salon', { preHandler: requireAuth }, async (request) => {
    const salon = await getSalon(prisma, request.session!.salonId);
    return {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      logoUrl: salon.logoUrl,
      brandColor: salon.brandColor,
      stampsRequired: salon.stampsRequired,
      rewardDescription: salon.rewardDescription,
    };
  });

  app.patch<{ Body: SalonSettingsPatch }>(
    '/api/salon',
    {
      preHandler: requireOwner,
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            brandColor: { type: 'string', minLength: 1 },
            stampsRequired: { type: 'integer', minimum: 1 },
            rewardDescription: { type: 'string', minLength: 1 },
            logoUrl: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const salon = await updateSalonSettings(prisma, request.session!.salonId, request.body);
      return {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        logoUrl: salon.logoUrl,
        brandColor: salon.brandColor,
        stampsRequired: salon.stampsRequired,
        rewardDescription: salon.rewardDescription,
      };
    },
  );

  app.get('/api/staff', { preHandler: requireAuth }, async (request) => {
    const staff = await listStaff(prisma, request.session!.salonId);
    return staff.map((s) => ({ id: s.id, email: s.email, role: s.role, createdAt: s.createdAt }));
  });

  app.post<{ Body: AddStaffBody }>(
    '/api/staff',
    {
      preHandler: requireOwner,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['owner', 'staff'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, role = 'staff' } = request.body;
      try {
        const passwordHash = await hashPassword(password);
        const staff = await addStaff(prisma, { salonId: request.session!.salonId, email, passwordHash, role });
        return reply.code(201).send({ id: staff.id, email: staff.email, role: staff.role });
      } catch (err) {
        if (err instanceof EmailTakenError) return reply.code(409).send({ error: 'email_taken' });
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/api/staff/:id', { preHandler: requireOwner }, async (request, reply) => {
    try {
      await removeStaff(prisma, request.session!.salonId, request.params.id);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof StaffNotFoundError) return reply.code(404).send({ error: 'staff_not_found' });
      if (err instanceof LastOwnerError) return reply.code(409).send({ error: 'last_owner' });
      throw err;
    }
  });
}
