export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Reads VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT from env. Throws with a clear message
 * if any is missing, rather than failing later with a confusing web-push error. */
export function loadVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY is not set (see .env.example)');
  if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set (see .env.example)');
  if (!subject) throw new Error('VAPID_SUBJECT is not set (see .env.example)');
  return { publicKey, privateKey, subject };
}
