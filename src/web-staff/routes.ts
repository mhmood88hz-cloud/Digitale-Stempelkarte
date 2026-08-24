import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/tenantGuard';
import { renderScanPage } from './scanPage';

// jsQR decodes QR codes from raw pixel data in plain JS -- unlike the browser-native
// BarcodeDetector API, it works in WebKit (Safari and every iOS browser, which is forced to use
// WebKit under Apple's rules) since it only needs getUserMedia + canvas, both of which iOS
// supports. Served as a static file rather than loaded from a CDN so the scan page has no
// external runtime dependency.
const JSQR_SOURCE = readFileSync(require.resolve('jsqr/dist/jsQR.js'), 'utf8');

export function registerWebStaffRoutes(app: FastifyInstance): void {
  app.get('/staff/scan', { preHandler: requireAuth }, async (_request, reply) => {
    reply.type('text/html').send(renderScanPage());
  });

  app.get('/staff/jsqr.js', async (_request, reply) => {
    reply.type('application/javascript').send(JSQR_SOURCE);
  });
}
