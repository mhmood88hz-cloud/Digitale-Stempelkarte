import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth/tenantGuard';
import { parseMonth, currentMonth } from './monthRange';
import { buildMonthlyReport } from './reportRepository';

export interface ReportRoutesOptions {
  prisma: PrismaClient;
}

export function registerReportRoutes(app: FastifyInstance, options: ReportRoutesOptions): void {
  const { prisma } = options;

  app.get<{ Querystring: { month?: string } }>(
    '/api/reports/monthly',
    { preHandler: requireAuth },
    async (request, reply) => {
      let range;
      try {
        range = request.query.month ? parseMonth(request.query.month) : currentMonth();
      } catch {
        return reply.code(400).send({ error: 'invalid_month' });
      }

      const report = await buildMonthlyReport(prisma, request.session!.salonId, range);
      return reply.send(report);
    },
  );
}
