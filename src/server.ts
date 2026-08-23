import { buildApp } from './app';
import { prisma } from './db/prisma';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET is not set (see .env.example)');
}

const app = buildApp({
  prisma,
  sessionSecret,
  secureCookies: process.env.NODE_ENV === 'production',
});

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
