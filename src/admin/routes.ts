import type { FastifyInstance } from 'fastify';
import type { PrismaClient, Salon } from '@prisma/client';
import { requireAuth, requireOwner } from '../auth/tenantGuard';
import { hashPassword } from '../auth/password';
import { getSalon, updateSalonSettings, type SalonSettingsPatch } from './salonRepository';
import {
  addStaff,
  EmailTakenError,
  getStaffStampCountsToday,
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

function serializeSalon(salon: Salon) {
  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    logoUrl: salon.logoUrl,
    brandColor: salon.brandColor,
    stampsRequired: salon.stampsRequired,
    rewardDescription: salon.rewardDescription,
    reminderIntervalDays: salon.reminderIntervalDays,
    locationLat: salon.locationLat,
    locationLng: salon.locationLng,
  };
}

export function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions): void {
  const { prisma } = options;

  app.get('/api/salon', { preHandler: requireAuth }, async (request) => {
    const salon = await getSalon(prisma, request.session!.salonId);
    return serializeSalon(salon);
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
            reminderIntervalDays: { type: ['integer', 'null'], minimum: 1 },
            locationLat: { type: ['number', 'null'], minimum: -90, maximum: 90 },
            locationLng: { type: ['number', 'null'], minimum: -180, maximum: 180 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const salon = await updateSalonSettings(prisma, request.session!.salonId, request.body);
      return serializeSalon(salon);
    },
  );

  app.get('/api/staff', { preHandler: requireAuth }, async (request) => {
    const salonId = request.session!.salonId;
    const [staff, todayCounts] = await Promise.all([listStaff(prisma, salonId), getStaffStampCountsToday(prisma, salonId)]);
    return staff.map((s) => ({
      id: s.id,
      email: s.email,
      role: s.role,
      createdAt: s.createdAt,
      stampsToday: todayCounts[s.id] ?? 0,
    }));
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
