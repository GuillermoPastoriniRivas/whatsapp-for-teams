function requireEnv(key: string, fallbackForDev?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if (fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable: ${key}`);
}

// Todo se lee DENTRO del factory: ConfigModule carga el .env en process.env
// justo antes de invocarlo. Cualquier lectura a nivel de módulo corre al
// importar el archivo, cuando process.env todavía no tiene nada del .env.
export default () => {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const apiUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${port}`;

  return {
    port,
    mongodb: {
      uri: requireEnv(
        'MONGODB_URI',
        'mongodb://localhost:27017/whatsapp-teams',
      ),
    },
    jwt: {
      secret: requireEnv('JWT_SECRET', 'dev-secret-do-not-use-in-prod'),
      expiresIn: process.env.JWT_EXPIRES_IN ?? '3d',
      refreshSecret: requireEnv(
        'JWT_REFRESH_SECRET',
        'dev-refresh-secret-do-not-use-in-prod',
      ),
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    meta: {
      apiVersion: process.env.META_API_VERSION ?? 'v21.0',
      webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
    },
    ses: {
      region:
        process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      fromEmail: process.env.SES_FROM_EMAIL ?? 'no-reply@asis.chat',
      replyToEmail: process.env.SES_REPLY_TO_EMAIL ?? 'contact@asis.chat',
    },
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    /** Base pública de la API; se usa para armar las URLs de media. */
    apiUrl,
    media: {
      /**
       * Dominio desde el que se sirve contenido subido por terceros. Idealmente
       * distinto al de la app (media.asis.chat): un SVG o un HTML servido desde
       * asis.chat es XSS almacenado con la sesión de todos.
       */
      publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? apiUrl,
      /** Firma de las URLs del proxy. Cae al secreto de JWT si no se define. */
      urlSecret:
        process.env.MEDIA_URL_SECRET ??
        process.env.JWT_SECRET ??
        'dev-secret-do-not-use-in-prod',
      /** Vida de una URL de lectura (firmada o del proxy), en segundos. */
      urlTtlSeconds: parseInt(process.env.MEDIA_URL_TTL_SECONDS ?? '900', 10),
      /** Cuánto puede cachear el navegador un archivo ya descargado. */
      browserCacheSeconds: parseInt(
        process.env.MEDIA_BROWSER_CACHE_SECONDS ?? '86400',
        10,
      ),
    },
    vapid: {
      publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
      privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
      subject: process.env.VAPID_SUBJECT ?? 'mailto:no-reply@asis.chat',
    },
    lemonSqueezy: {
      apiKey: process.env.LEMON_SQUEEZY_API_KEY ?? '',
      storeId: process.env.LEMON_SQUEEZY_STORE_ID ?? '',
      webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? '',
      variants: {
        pro: process.env.LEMON_SQUEEZY_VARIANT_PRO ?? '',
        business: process.env.LEMON_SQUEEZY_VARIANT_BUSINESS ?? '',
        agencies: process.env.LEMON_SQUEEZY_VARIANT_AGENCIES ?? '',
      },
    },
  };
};
