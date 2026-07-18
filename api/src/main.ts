import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter.js';

/** Migración one-shot (idempotente): el concepto "resuelta" se eliminó del producto. */
async function migrateResolvedConversations(app: NestExpressApplication) {
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const result = await connection.collection('conversations').updateMany(
      { status: 'resolved' },
      [
        {
          $set: {
            status: {
              $cond: [{ $ne: ['$agentId', null] }, 'active', 'unassigned'],
            },
          },
        },
      ],
    );
    if (result.modifiedCount > 0) {
      console.log(`[migration] ${result.modifiedCount} conversaciones 'resolved' migradas`);
    }
  } catch (err) {
    console.error('[migration] resolved->active/unassigned falló:', err);
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  await migrateResolvedConversations(app);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature'],
    maxAge: 86400,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WhatsApp Teams API')
    .setDescription('Multi-tenant WhatsApp routing and team inbox API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('Auth', 'Authentication & session management')
    .addTag('Agents', 'Agent CRUD & phone access management')
    .addTag('Phone Numbers', 'WhatsApp phone number management')
    .addTag('Conversations', 'Conversation listing, messaging & lifecycle')
    .addTag('Contacts', 'Contact details & updates')
    .addTag('Tenants', 'Tenant management')
    .addTag('Webhooks', 'Inbound webhook receivers (Meta, Twilio)')
    .addTag('Payment Webhooks', 'Payment provider webhook receivers (Lemon Squeezy)')
    .addTag('Billing', 'Subscription management and billing')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    useGlobalPrefix: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
