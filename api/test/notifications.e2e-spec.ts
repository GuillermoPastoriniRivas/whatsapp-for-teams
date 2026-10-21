/**
 * e2e de la API pública de notificaciones (`/api/v1/notifications`).
 *
 * Casos que se cubren (Fases 1 y 2 del plan de notificaciones):
 *  1. POST crea la notificación y responde 202 con { id, status, sendAt, sandbox }.
 *  2. La misma Idempotency-Key con el mismo body devuelve el mismo id y no
 *     crea una segunda notificación.
 *  3. La misma Idempotency-Key con otro body responde 409 IDEMPOTENCY_KEY_REUSED.
 *  4. POST sin Idempotency-Key responde 400 MISSING_IDEMPOTENCY_KEY.
 *  5. GET /:id devuelve estado y timeline; un id inexistente responde
 *     404 NOTIFICATION_NOT_FOUND.
 *  6. GET con filtros (status, templateId, paginación) devuelve { data, meta }.
 *  7. Cancelar una scheduled la deja canceled y no se envía; sobre una ya
 *     enviada responde 409 NOTIFICATION_NOT_CANCELABLE.
 *  8. Una clave de prueba (ak_test_) nunca llega al proveedor: no se llama al
 *     puerto de mensajería, se emiten los eventos notification.* y no se
 *     escribe message-charge.
 *  9. Una clave sin el scope notifications:write recibe 403 MISSING_SCOPE.
 *
 * Supuestos del contrato (si la implementación difiere, el test lo dice):
 *  - una notificación con `sendAt` en el futuro queda en estado `scheduled`;
 *  - `sandbox` es true solo con una clave de prueba y false con una real;
 *  - sin `Idempotency-Key` el error es 400 MISSING_IDEMPOTENCY_KEY.
 *
 * La base de datos es la de e2e (ver test/support/notification-fixtures.ts):
 * la app no toca la base real ni Meta.
 *
 * Cómo correrla:
 *   npx jest --config ./test/jest-e2e.json --testPathPatterns notifications.e2e-spec --forceExit
 * El config e2e necesita `moduleNameMapper` (las imports del `src/` llevan
 * extensión `.js`) y `forceExit` (la cola Agenda deja la conexión de Mongo
 * abierta). Detalle en fluws: asis/gotcha-suite-e2e-asis-chat-no-levanta.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { GlobalExceptionFilter } from '../src/presentation/filters/global-exception.filter';
// Importado primero a propósito: este módulo fija la base de e2e en
// `process.env` antes de que se importe `AppModule` (que es lo que lee el .env).
import {
  NOTIFICATIONS_PATH,
  cleanupNotificationFixtures,
  countMessageCharges,
  countNotificationsByIdempotencyKey,
  createApprovedTemplate,
  createNotificationFixtures,
  forceNotificationStatus,
} from './support/notification-fixtures';
import type { NotificationFixtures } from './support/notification-fixtures';
import { AppModule } from '../src/app.module';

/** Lo que devuelve POST /v1/notifications. */
interface NotificationCreated {
  id: string;
  status: string;
  sendAt: string | null;
  sandbox: boolean;
}

/** Lo que devuelve GET /v1/notifications/:id. */
interface NotificationDetail extends NotificationCreated {
  to: string | null;
  templateId: string | null;
  messageId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  timeline: { status: string; at: string | null }[];
}

/** Lo que devuelve GET /v1/notifications. */
interface NotificationList {
  data: NotificationDetail[];
  meta: { page: number; limit: number; total: number; pages: number };
}

/** Lo que devuelve un error de la API. */
interface ApiError {
  code?: string;
  message?: string;
}

/** Espera a que una condición se cumpla, sin pasarse del timeout. */
async function waitFor<T>(
  probe: () => T | undefined,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('API pública de notificaciones (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let fixtures: NotificationFixtures;

  const futureSendAt = (): string =>
    new Date(Date.now() + 10 * 60 * 1000).toISOString();

  /** Consulta el detalle hasta que el estado esté entre los esperados. */
  const waitForStatus = async (
    id: string,
    apiKey: string,
    statuses: string[],
    timeoutMs = 8000,
  ): Promise<NotificationDetail | undefined> => {
    const deadline = Date.now() + timeoutMs;
    let last: NotificationDetail | undefined;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`${NOTIFICATIONS_PATH}/${id}`)
        .set('X-Api-Key', apiKey);
      if (res.status === 200) {
        last = res.body as NotificationDetail;
        if (statuses.includes(last.status)) return last;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return last;
  };

  const notificationBody = (templateId: string, sendAt?: string) => ({
    to: fixtures.recipientPhone,
    templateId,
    variables: { 'body.1': 'E2E' },
    ...(sendAt ? { sendAt } : {}),
    metadata: { source: 'e2e' },
  });

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Rutas y formato de error como en producción (ver src/main.ts).
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    fixtures = await createNotificationFixtures(app);
  }, 120_000);

  afterAll(async () => {
    if (app) {
      if (fixtures) await cleanupNotificationFixtures(app, fixtures);
      await app.close();
    }
  });

  it('1. POST /api/v1/notifications crea la notificación y responde 202', async () => {
    const res = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));

    expect(res.status).toBe(202);

    const body = res.body as NotificationCreated;
    expect(typeof body.id).toBe('string');
    expect(typeof body.status).toBe('string');
    expect(typeof body.sendAt).toBe('string');
    expect(typeof body.sandbox).toBe('boolean');
    expect(body.status).toBe('scheduled');
    expect(body.sandbox).toBe(false);
  });

  it('2. La misma Idempotency-Key con el mismo body devuelve el mismo id y no crea otra', async () => {
    const idempotencyKey = `e2e-${randomUUID()}`;
    const body = notificationBody(fixtures.templateId, futureSendAt());

    const first = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);

    const second = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);

    const firstBody = first.body as NotificationCreated;
    const secondBody = second.body as NotificationCreated;
    expect(secondBody.id).toBe(firstBody.id);

    const created = await countNotificationsByIdempotencyKey(
      app,
      fixtures.tenantId,
      idempotencyKey,
    );
    expect(created).toBe(1);
  });

  it('3. La misma Idempotency-Key con otro body responde 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const idempotencyKey = `e2e-${randomUUID()}`;

    const first = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', idempotencyKey)
      .send(notificationBody(fixtures.templateId, futureSendAt()));

    const second = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', idempotencyKey)
      .send(notificationBody(fixtures.templateId));

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect((second.body as ApiError).code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('4. POST sin Idempotency-Key responde 400', async () => {
    const res = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .send(notificationBody(fixtures.templateId, futureSendAt()));

    expect(res.status).toBe(400);
    expect((res.body as ApiError).code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('5. GET /api/v1/notifications/:id devuelve estado y timeline; id inexistente responde 404', async () => {
    const created = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));
    expect(created.status).toBe(202);
    const createdBody = created.body as NotificationCreated;

    const found = await request(app.getHttpServer())
      .get(`${NOTIFICATIONS_PATH}/${createdBody.id}`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(found.status).toBe(200);
    const foundBody = found.body as NotificationDetail;
    expect(foundBody.id).toBe(createdBody.id);
    expect(foundBody.status).toEqual(expect.any(String));
    expect(Array.isArray(foundBody.timeline)).toBe(true);

    const missing = await request(app.getHttpServer())
      .get(`${NOTIFICATIONS_PATH}/ntf_000000000000000000000000`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(missing.status).toBe(404);
    expect((missing.body as ApiError).code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('6. GET /api/v1/notifications con filtros devuelve { data, meta } coherente', async () => {
    const otherTemplateId = await createApprovedTemplate(
      app,
      fixtures.tenantId,
      fixtures.phoneNumberId,
      fixtures.wabaId,
    );

    const mine = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));

    const other = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(otherTemplateId, futureSendAt()));

    expect(mine.status).toBe(202);
    expect(other.status).toBe(202);
    const mineBody = mine.body as NotificationCreated;
    const otherBody = other.body as NotificationCreated;

    const res = await request(app.getHttpServer())
      .get(
        `${NOTIFICATIONS_PATH}?status=scheduled&templateId=${fixtures.templateId}&page=1&limit=10`,
      )
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(res.status).toBe(200);
    const list = res.body as NotificationList;
    expect(Array.isArray(list.data)).toBe(true);
    expect(typeof list.meta.total).toBe('number');
    expect(typeof list.meta.page).toBe('number');

    const ids = list.data.map((n) => n.id);
    expect(ids).toContain(mineBody.id);
    expect(ids).not.toContain(otherBody.id);

    const paged = await request(app.getHttpServer())
      .get(`${NOTIFICATIONS_PATH}?page=1&limit=1`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(paged.status).toBe(200);
    expect((paged.body as NotificationList).data.length).toBeLessThanOrEqual(1);
  });

  it('7. Cancelar una scheduled la deja canceled; una ya enviada responde 409', async () => {
    const scheduled = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));
    expect(scheduled.status).toBe(202);
    const scheduledBody = scheduled.body as NotificationCreated;

    const canceled = await request(app.getHttpServer())
      .post(`${NOTIFICATIONS_PATH}/${scheduledBody.id}/cancel`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(canceled.status).toBe(200);
    expect((canceled.body as NotificationCreated).status).toBe('canceled');

    const afterCancel = await request(app.getHttpServer())
      .get(`${NOTIFICATIONS_PATH}/${scheduledBody.id}`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(afterCancel.status).toBe(200);
    const afterBody = afterCancel.body as NotificationDetail;
    expect(afterBody.status).toBe('canceled');
    // Cancelada no se envía: no tiene mensaje asociado.
    expect(afterBody.messageId ?? null).toBeNull();

    const sent = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));
    expect(sent.status).toBe(202);
    const sentBody = sent.body as NotificationCreated;

    const forced = await forceNotificationStatus(app, sentBody.id, 'sent', {
      sentAt: new Date(),
    });
    expect(forced).toBe(true);

    const cancelSent = await request(app.getHttpServer())
      .post(`${NOTIFICATIONS_PATH}/${sentBody.id}/cancel`)
      .set('X-Api-Key', fixtures.liveKey.plainKey);

    expect(cancelSent.status).toBe(409);
    expect((cancelSent.body as ApiError).code).toBe(
      'NOTIFICATION_NOT_CANCELABLE',
    );
  });

  it('8. Una clave ak_test_ no llega al proveedor, emite notification.* y no cobra', async () => {
    const messaging = app.get<{
      sendMessage: (...args: unknown[]) => Promise<unknown>;
      markAsRead: (...args: unknown[]) => Promise<unknown>;
    }>('MessagingApiPort');
    const developerEvents = app.get<{ emit: (...args: unknown[]) => void }>(
      'DeveloperEventsPort',
    );
    const sendMessage = jest.spyOn(messaging, 'sendMessage');
    const markAsRead = jest.spyOn(messaging, 'markAsRead');
    const emit = jest.spyOn(developerEvents, 'emit');

    try {
      const chargesBefore = await countMessageCharges(app, fixtures.tenantId);

      const res = await request(app.getHttpServer())
        .post(NOTIFICATIONS_PATH)
        .set('X-Api-Key', fixtures.testKey.plainKey)
        .set('Idempotency-Key', `e2e-${randomUUID()}`)
        .send(notificationBody(fixtures.templateId, futureSendAt()));

      expect(res.status).toBe(202);
      expect((res.body as NotificationCreated).sandbox).toBe(true);

      // El proveedor no se toca, ni de forma diferida.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(sendMessage).not.toHaveBeenCalled();
      expect(markAsRead).not.toHaveBeenCalled();

      // Los eventos de desarrollador salen con el prefijo notification.*
      const notificationEvent = await waitFor(() =>
        emit.mock.calls.find((call: unknown[]) =>
          String(call[1]).startsWith('notification.'),
        ),
      );
      expect(notificationEvent).toBeDefined();

      // Y no se cobra el mensaje.
      expect(await countMessageCharges(app, fixtures.tenantId)).toBe(
        chargesBefore,
      );
    } finally {
      sendMessage.mockRestore();
      markAsRead.mockRestore();
      emit.mockRestore();
    }
  });

  it('9. Una clave sin el scope notifications:write recibe 403 MISSING_SCOPE', async () => {
    const res = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.unscopedKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId, futureSendAt()));

    expect(res.status).toBe(403);
    expect((res.body as ApiError).code).toBe('MISSING_SCOPE');
  });

  it('10. Una clave live envía, queda sent y genera cargo', async () => {
    const chargesBefore = await countMessageCharges(app, fixtures.tenantId);

    const created = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.liveKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId));

    expect(created.status).toBe(202);
    const body = created.body as NotificationCreated;
    expect(body.status).toBe('queued');
    expect(body.sandbox).toBe(false);

    const detail = await waitForStatus(
      body.id,
      fixtures.liveKey.plainKey,
      ['sent', 'delivered', 'read'],
    );
    expect(detail).toBeDefined();
    expect(['sent', 'delivered', 'read']).toContain(detail!.status);
    expect(detail!.sentAt).toBeTruthy();
    expect(await countMessageCharges(app, fixtures.tenantId)).toBeGreaterThan(
      chargesBefore,
    );
  });

  it('11. Una notificación de sandbox inmediata avanza sola y no cobra', async () => {
    const chargesBefore = await countMessageCharges(app, fixtures.tenantId);

    const created = await request(app.getHttpServer())
      .post(NOTIFICATIONS_PATH)
      .set('X-Api-Key', fixtures.testKey.plainKey)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send(notificationBody(fixtures.templateId));

    expect(created.status).toBe(202);
    const body = created.body as NotificationCreated;
    expect(body.status).toBe('queued');
    expect(body.sandbox).toBe(true);

    const detail = await waitForStatus(
      body.id,
      fixtures.testKey.plainKey,
      ['delivered', 'read'],
    );
    expect(detail).toBeDefined();
    expect(['delivered', 'read']).toContain(detail!.status);

    const steps = detail!.timeline.map((entry) => entry.status);
    expect(steps).toContain('scheduled');
    expect(steps).toContain('queued');
    expect(steps).toContain('sent');
    expect(steps).toContain('delivered');

    expect(await countMessageCharges(app, fixtures.tenantId)).toBe(chargesBefore);
  });

  it('12. El panel expone /api/notifications y exige sesión (401, no 404)', async () => {
    const list = await request(app.getHttpServer()).get('/api/notifications');
    expect(list.status).toBe(401);

    const detail = await request(app.getHttpServer()).get('/api/notifications/ntf_1');
    expect(detail.status).toBe(401);
  });
});
