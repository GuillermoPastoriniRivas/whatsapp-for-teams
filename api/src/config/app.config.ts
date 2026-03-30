export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/whatsapp-teams',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  meta: {
    apiVersion: process.env.META_API_VERSION ?? 'v21.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
  },
});
