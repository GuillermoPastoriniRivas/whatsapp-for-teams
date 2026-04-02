import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.enableCors();

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
