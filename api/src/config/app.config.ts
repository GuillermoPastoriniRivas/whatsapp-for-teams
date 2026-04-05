function requireEnv(key: string, fallbackForDev?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if (fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable: ${key}`);
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodb: {
    uri: requireEnv('MONGODB_URI', 'mongodb://localhost:27017/whatsapp-teams'),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-secret-do-not-use-in-prod'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '3d',
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-do-not-use-in-prod'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  meta: {
    apiVersion: process.env.META_API_VERSION ?? 'v21.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  ses: {
    region: process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    fromEmail: process.env.SES_FROM_EMAIL ?? 'no-reply@asis.chat',
    replyToEmail: process.env.SES_REPLY_TO_EMAIL ?? 'contact@asis.chat',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
});
