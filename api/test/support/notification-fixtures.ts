/**
 * Fixtures de la API pública de notificaciones (suite e2e).
 *
 * Reglas del fixture:
 * - Nada de datos personales: las cuentas se llaman "e2e" y los números usan el
 *   rango reservado para ficción (+1 202 555 01xx).
 * - Nada de credenciales reales: las claves se generan con `randomBytes` y se
 *   guarda solo su hash SHA-256, igual que la app.
 * - Nada de tráfico a Meta: el número del fixture usa el proveedor "demo".
 * - Base de datos dedicada: la suite nunca corre contra la base de la app
 *   (`E2E_DATABASE_NAME`), así los fixtures no pisan datos reales.
 *
 * `E2E_MONGO_URI` se aplica al importar este módulo, antes de que se importe
 * `AppModule`: `ConfigModule.forRoot` lee el `.env` al importar el módulo de la
 * app, pero `process.env` gana sobre el archivo, así que este valor manda.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';

/** Base donde corre la suite. Nunca la de la app. */
export const E2E_DATABASE_NAME =
  process.env.E2E_DB_NAME ?? 'whatsapp-teams-e2e';

/** Destinatario de prueba (+1 202 555 0100 está reservado para ficción). */
export const E2E_RECIPIENT_PHONE = '+12025550100';

/** Número emisor del fixture, también de ficción. */
export const E2E_SENDER_PHONE = '+12025550101';

/** Scopes que habilitan la API de notificaciones (los define T2). */
export const NOTIFICATION_SCOPES = [
  'notifications:read',
  'notifications:write',
];

/** Scopes de una clave que no puede tocar notificaciones. */
export const MESSAGING_ONLY_SCOPES = ['messages:read', 'messages:write'];

/** Ruta base de la API pública de notificaciones. */
export const NOTIFICATIONS_PATH = '/api/v1/notifications';

const FALLBACK_MONGO_URI = 'mongodb://localhost:27017/whatsapp-teams';

export type ApiKeyMode = 'live' | 'test';

export interface ApiKeyFixture {
  /** La clave en claro: solo existe en memoria, para mandarla en el header. */
  plainKey: string;
  keyId: string;
  tenantId: string;
  scopes: string[];
  mode: ApiKeyMode;
}

export interface NotificationFixtures {
  tenantId: string;
  /** Clave real (ak_live_) con permisos de notificaciones. */
  liveKey: ApiKeyFixture;
  /** Clave de prueba (ak_test_): nunca llega a Meta. */
  testKey: ApiKeyFixture;
  /** Clave sin permisos de notificaciones: sirve para el 403 por scope. */
  unscopedKey: ApiKeyFixture;
  /** Id interno del número de WhatsApp del fixture. */
  phoneNumberId: string;
  /** Id interno de la plantilla aprobada. */
  templateId: string;
  /** wabaId del número del fixture. */
  wabaId: string;
  /** Destinatario de las notificaciones de prueba. */
  recipientPhone: string;
}

/** Lee una variable del `.env` sin depender de que dotenv la haya cargado. */
function readEnvFileValue(key: string): string | undefined {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '..', '.env'),
  ];
  for (const file of candidates) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
    if (!match) continue;
    const value = match[1].trim().replace(/^["']|["']$/g, '');
    if (value && !value.startsWith('#')) return value;
  }
  return undefined;
}

/** Cambia el nombre de la base de una URI de Mongo sin tocar el resto. */
export function withDatabaseName(uri: string, databaseName: string): string {
  const [base, ...rest] = uri.split('?');
  const query = rest.length ? `?${rest.join('?')}` : '';
  const schemeEnd = base.indexOf('://');
  if (schemeEnd === -1) return uri;
  const afterScheme = base.slice(schemeEnd + 3);
  const slash = afterScheme.indexOf('/');
  const authority = slash === -1 ? afterScheme : afterScheme.slice(0, slash);
  return `${base.slice(0, schemeEnd + 3)}${authority}/${databaseName}${query}`;
}

/**
 * URI de la base de e2e. `E2E_MONGODB_URI` se respeta tal cual; si no está,
 * se parte de la URI del entorno (o del `.env`) y se le cambia SOLO el nombre
 * de la base, para no tocar los datos de la app.
 */
export function resolveE2EMongoUri(): string {
  const explicit = process.env.E2E_MONGODB_URI;
  if (explicit) return explicit;
  const base =
    process.env.MONGODB_URI ??
    readEnvFileValue('MONGODB_URI') ??
    FALLBACK_MONGO_URI;
  return withDatabaseName(base, E2E_DATABASE_NAME);
}

/** URI con la que corre la suite. */
export const E2E_MONGO_URI = resolveE2EMongoUri();

// Se aplica al importar el módulo (antes de que se importe `AppModule`).
process.env.MONGODB_URI = E2E_MONGO_URI;

function connection(app: INestApplication): Connection {
  return app.get<Connection>(getConnectionToken());
}

/** Crea la cuenta de prueba. */
export async function createTenant(
  app: INestApplication,
  name = 'E2E Notificaciones',
): Promise<string> {
  const slug = `e2e-notif-${randomBytes(6).toString('hex')}`;
  const result = await connection(app).collection('tenants').insertOne({
    name,
    slug,
    isDemo: false,
    businessProfile: null,
    timezone: null,
    businessHours: null,
    aiRateLimits: null,
    createdAt: new Date(),
  });
  return String(result.insertedId);
}

/**
 * Crea una clave de API de prueba. Se guarda solo el hash, como la app, y el
 * modo (`live`/`test`) en el campo `mode`, que es el que T3 agrega al modelo.
 */
export async function createApiKey(
  app: INestApplication,
  options: {
    tenantId: string;
    scopes: string[];
    mode: ApiKeyMode;
    name?: string;
  },
): Promise<ApiKeyFixture> {
  const prefix = options.mode === 'test' ? 'ak_test_' : 'ak_live_';
  const plainKey = `${prefix}${randomBytes(20).toString('hex')}`;
  const keyHash = createHash('sha256').update(plainKey, 'utf8').digest('hex');
  const result = await connection(app)
    .collection('api_keys')
    .insertOne({
      tenantId: new Types.ObjectId(options.tenantId),
      name: options.name ?? `e2e ${options.mode}`,
      prefix: plainKey.slice(0, 12),
      keyHash,
      scopes: options.scopes,
      createdBy: null,
      lastUsedAt: null,
      revokedAt: null,
      mode: options.mode,
      createdAt: new Date(),
    });
  return {
    plainKey,
    keyId: String(result.insertedId),
    tenantId: options.tenantId,
    scopes: options.scopes,
    mode: options.mode,
  };
}

/**
 * Crea el número de WhatsApp de la cuenta de prueba. Va con el proveedor
 * "demo": el fixture no genera tráfico a Meta ni guarda credenciales.
 */
export async function createPhoneNumber(
  app: INestApplication,
  tenantId: string,
): Promise<{ phoneNumberId: string; wabaId: string }> {
  const suffix = randomBytes(6).toString('hex');
  const wabaId = `e2e-waba-${suffix}`;
  const result = await connection(app)
    .collection('phone_numbers')
    .insertOne({
      tenantId: new Types.ObjectId(tenantId),
      provider: 'demo',
      providerConfig: { accessToken: 'e2e-not-a-real-token' },
      wabaId,
      portfolioId: null,
      phoneNumberId: `100${randomBytes(6).toString('hex')}`,
      displayPhone: E2E_SENDER_PHONE,
      label: 'e2e',
      webhookSecret: `e2e-${suffix}`,
      status: 'active',
      businessProfile: null,
      health: null,
      createdAt: new Date(),
    });
  return { phoneNumberId: String(result.insertedId), wabaId };
}

/** Crea una plantilla aprobada con un placeholder en el cuerpo. */
export async function createApprovedTemplate(
  app: INestApplication,
  tenantId: string,
  phoneNumberId: string,
  wabaId: string,
): Promise<string> {
  const result = await connection(app)
    .collection('message_templates')
    .insertOne({
      tenantId: new Types.ObjectId(tenantId),
      phoneNumberId: new Types.ObjectId(phoneNumberId),
      wabaId,
      // El índice único de metaTemplateId no admite dos null: se da uno propio.
      metaTemplateId: `e2e-meta-${randomBytes(6).toString('hex')}`,
      name: `e2e_template_${randomBytes(4).toString('hex')}`,
      language: 'en_US',
      category: 'utility',
      status: 'approved',
      qualityScore: 'green',
      components: [{ type: 'BODY', text: 'Aviso e2e para {{nombre}}' }],
      rejectionReason: null,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return String(result.insertedId);
}

/** Cuenta, plantilla y tres claves: lo que necesita la suite. */
export async function createNotificationFixtures(
  app: INestApplication,
): Promise<NotificationFixtures> {
  const tenantId = await createTenant(app);
  const { phoneNumberId, wabaId } = await createPhoneNumber(app, tenantId);
  const templateId = await createApprovedTemplate(
    app,
    tenantId,
    phoneNumberId,
    wabaId,
  );
  const liveKey = await createApiKey(app, {
    tenantId,
    scopes: [...NOTIFICATION_SCOPES],
    mode: 'live',
  });
  const testKey = await createApiKey(app, {
    tenantId,
    scopes: [...NOTIFICATION_SCOPES],
    mode: 'test',
  });
  const unscopedKey = await createApiKey(app, {
    tenantId,
    scopes: [...MESSAGING_ONLY_SCOPES],
    mode: 'live',
  });
  return {
    tenantId,
    liveKey,
    testKey,
    unscopedKey,
    phoneNumberId,
    templateId,
    wabaId,
    recipientPhone: E2E_RECIPIENT_PHONE,
  };
}

/** Borra todo lo que creó el fixture. No toca datos de otras cuentas. */
export async function cleanupNotificationFixtures(
  app: INestApplication,
  fixtures: NotificationFixtures,
): Promise<void> {
  const db = connection(app);
  const tenantId = new Types.ObjectId(fixtures.tenantId);
  const conversations = await db
    .collection('conversations')
    .find({ tenantId })
    .project<{ _id: Types.ObjectId }>({ _id: 1 })
    .toArray();
  const conversationIds: Types.ObjectId[] = conversations.map((c) => c._id);
  const notificationIds = (
    await db
      .collection('notifications')
      .find({ tenantId })
      .project<{ publicId: string }>({ publicId: 1 })
      .toArray()
  ).map((n) => n.publicId);
  await db
    .collection('messages')
    .deleteMany({ conversationId: { $in: conversationIds } });
  // Los jobs de Agenda no tienen tenant: se borran por el id público de la
  // notificación. Si no, quedan programados para dentro de 10 minutos y
  // despiertan contra documentos que ya no existen.
  await db
    .collection('jobs')
    .deleteMany({ 'data.notificationId': { $in: notificationIds } });
  await Promise.all([
    db.collection('notifications').deleteMany({ tenantId }),
    db.collection('message_charges').deleteMany({ tenantId }),
    db.collection('webhook_deliveries').deleteMany({ tenantId }),
    db.collection('conversations').deleteMany({ tenantId }),
    db.collection('contacts').deleteMany({ tenantId }),
    db.collection('message_templates').deleteMany({ tenantId }),
    db.collection('phone_numbers').deleteMany({ tenantId }),
    db.collection('api_keys').deleteMany({ tenantId }),
    db.collection('tenants').deleteMany({ _id: tenantId }),
  ]);
}

/**
 * Cuenta las notificaciones de una cuenta con una clave de idempotencia.
 * Se usa para comprobar que un reintento no crea una segunda.
 */
export async function countNotificationsByIdempotencyKey(
  app: INestApplication,
  tenantId: string,
  idempotencyKey: string,
): Promise<number> {
  return connection(app)
    .collection('notifications')
    .countDocuments({
      idempotencyKey,
      $or: [{ tenantId: new Types.ObjectId(tenantId) }, { tenantId }],
    });
}

/** Cuenta los cobros de la cuenta: en sandbox tiene que ser cero. */
export async function countMessageCharges(
  app: INestApplication,
  tenantId: string,
): Promise<number> {
  return connection(app)
    .collection('message_charges')
    .countDocuments({ tenantId: new Types.ObjectId(tenantId) });
}

/**
 * Deja una notificación en un estado concreto. Sirve para el caso de cancelar
 * una que ya salió, que si no dependería de hablar con Meta.
 * Devuelve false si no encuentra la notificación.
 */
export async function forceNotificationStatus(
  app: INestApplication,
  id: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  // El id público puede vivir en cualquiera de estos campos según cómo lo
  // guarde la implementación, así que se buscan todos.
  const filter: Record<string, unknown> = {
    $or: [{ publicId: id }, { notificationId: id }, { id }, { _id: id }],
  };
  const result = await connection(app)
    .collection('notifications')
    .updateOne(filter, { $set: { status, ...extra } });
  return result.matchedCount > 0;
}
