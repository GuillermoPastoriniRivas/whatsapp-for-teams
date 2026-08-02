import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter.js';
import { SUBSCRIBABLE_DEVELOPER_EVENTS } from './domain/enums/developer-event-type.enum.js';

/** Prefijo de la API pública; todo lo demás es la app interna. */
const PUBLIC_API_PREFIX = '/api/v1';

/**
 * Portada de la referencia pública. Va en markdown porque es lo primero que
 * lee un integrador: autenticación, límites, forma de los errores y firma de
 * webhooks, sin obligarlo a salir a buscar otra página.
 */
function publicApiDescription(): string {
  return [
    'API REST para integrar WhatsApp de Asis Chat en tu propia aplicación.',
    '',
    '### Autenticación',
    'Mandá tu clave en el header `X-Api-Key` (también se acepta `Authorization: Bearer ak_live_...`).',
    'Las claves se crean desde la app, en **Desarrolladores → Claves de API**.',
    '',
    '### Límites',
    'Hasta 120 solicitudes por minuto por clave. Al pasarte, la API responde `429` con el código `RATE_LIMIT_EXCEEDED`.',
    '',
    '### Errores',
    'Los errores devuelven `{ "code": "...", "message": "..." }`. El `code` es estable y es contra lo que conviene programar; el `message` es para humanos y puede cambiar.',
    '',
    '### Webhooks',
    'Registrá las URLs de tu servidor en **Desarrolladores → Webhooks** para que te avisemos con un POST cuando pasa algo en tu cuenta.',
    'Cada entrega viaja firmada en el header `X-Asis-Signature: t=<unix>,v1=<hmac>`, donde el HMAC es SHA-256 de la cadena `"<t>.<cuerpo crudo>"` usando el secreto del endpoint.',
    'Si tu servidor no responde 2xx reintentamos con backoff, hasta 6 intentos.',
    '',
    `Eventos disponibles: ${SUBSCRIBABLE_DEVELOPER_EVENTS.map((e) => `\`${e}\``).join(', ')}.`,
  ].join('\n');
}

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature', 'X-Api-Key'],
    maxAge: 86400,
  });

  // Documento interno: toda la superficie de la app. Es la referencia del
  // equipo, no la que se le pasa a un integrador.
  const internalConfig = new DocumentBuilder()
    .setTitle('Asis Chat — API interna')
    .setDescription('Superficie completa de la app (sesión JWT). La referencia pública para desarrolladores está en /api/docs.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'ApiKey')
    .addTag('Auth', 'Authentication & session management')
    .addTag('Agents', 'Agent CRUD & phone access management')
    .addTag('Phone Numbers', 'WhatsApp phone number management')
    .addTag('Conversations', 'Conversation listing, messaging & lifecycle')
    .addTag('Contacts', 'Contact details & updates')
    .addTag('Tenants', 'Tenant management')
    .addTag('Webhooks', 'Inbound webhook receivers (Meta, Twilio)')
    .addTag('Public API (v1)', 'REST API for developers (API key auth)')
    .addTag('Developer Platform', 'API keys & webhook endpoints management')
    .addTag('Payment Webhooks', 'Payment provider webhook receivers (Lemon Squeezy)')
    .addTag('Billing', 'Subscription management and billing')
    .build();

  const internalDocument = SwaggerModule.createDocument(app, internalConfig);
  SwaggerModule.setup('api/internal-docs', app, internalDocument, {
    useGlobalPrefix: false,
  });

  // Documento público: solo /v1. Mostrarle a un integrador los endpoints
  // internos es ruido — ninguno le sirve, todos exigen sesión de la app.
  const publicConfig = new DocumentBuilder()
    .setTitle('Asis Chat API')
    .setDescription(publicApiDescription())
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'ApiKey')
    .addTag('Public API (v1)', 'Mensajes, conversaciones y contactos')
    .build();

  const publicDocument = SwaggerModule.createDocument(app, publicConfig);
  publicDocument.paths = Object.fromEntries(
    Object.entries(publicDocument.paths).filter(([path]) => path.startsWith(PUBLIC_API_PREFIX)),
  );
  SwaggerModule.setup('api/docs', app, publicDocument, {
    useGlobalPrefix: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API pública (desarrolladores) at http://localhost:${port}/api/docs`);
  console.log(`API interna (equipo) at http://localhost:${port}/api/internal-docs`);
}

bootstrap();
