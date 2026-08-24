import { readFileSync } from 'node:fs';
import { buildApp } from './app';
import { prisma } from './db/prisma';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET is not set (see .env.example)');
}

// Local-dev-only HTTPS: needed to test camera-based scanning from a phone over the LAN (browsers
// require a secure context for camera access; a plain http://<lan-ip> address doesn't qualify,
// only https:// or localhost do). Never set these in production -- use a real reverse proxy/TLS
// termination there instead.
const devHttpsCertPath = process.env.DEV_HTTPS_CERT_PATH;
const devHttpsKeyPath = process.env.DEV_HTTPS_KEY_PATH;
const https =
  devHttpsCertPath && devHttpsKeyPath
    ? { cert: readFileSync(devHttpsCertPath), key: readFileSync(devHttpsKeyPath) }
    : undefined;

const app = buildApp({
  prisma,
  sessionSecret,
  secureCookies: process.env.NODE_ENV === 'production',
  https,
});

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
