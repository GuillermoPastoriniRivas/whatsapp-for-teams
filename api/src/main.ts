import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
