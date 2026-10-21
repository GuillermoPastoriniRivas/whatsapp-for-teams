import { Notification } from '../../../domain/entities/notification.entity.js';
import { MessageTemplate } from '../../../domain/entities/message-template.entity.js';
import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { NotificationStatus } from '../../../domain/enums/notification-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { TemplateCategory } from '../../../domain/enums/template-category.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { DomainError, MarketingOptOutError } from '../../../domain/errors/domain-errors.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { NotificationRepository } from '../../../domain/repositories/notification.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { Result, err, ok } from '../../common/result.js';
import { canonicalizeTemplateVariables } from '../campaign/helpers/template-variable.resolver.js';
import { templateBelongsToPhone } from '../template/helpers/template-scope.js';
import { NOTIFICATION_SEND_JOB } from './notification.jobs.js';
import {
  generateNotificationId,
  hashNotificationRequest,
  isObjectIdLike,
  normalizeNotificationRecipient,
  resolveNotificationPhone,
  serializeNotificationPayload,
} from './notification.util.js';

const MAX_METADATA_LENGTH = 4000;

export interface SendNotificationInput {
  tenantId: string;
  to: string;
  templateId?: string;
  template?: { name: string; language: string };
  variables?: Record<string, string>;
  sendAt?: string;
  metadata?: Record<string, unknown>;
  phoneNumberId?: string;
  idempotencyKey: string;
  sandbox?: boolean;
  createdByAgentId?: string | null;
}

interface ResolvedTemplate {
  template: MessageTemplate;
  variables: Record<string, string>;
}

/**
 * Crea la notificación y la deja agendada o encolada. La validación (número,
 * plantilla, variables) es síncrona para que el desarrollador reciba un 422
 * ahora y no un fallo asincrónico que descubra consultando el estado.
 *
 * El envío a Meta ocurre en el job `notification.send`: la respuesta HTTP es
 * 202 y el estado se sigue por GET o por webhook.
 */
export class SendNotificationUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly phones: PhoneNumberRepository,
    private readonly templates: MessageTemplateRepository,
    private readonly contacts: ContactRepository,
    private readonly queue: JobQueuePort,
    private readonly devEvents: DeveloperEventsPort,
  ) {}

  async execute(input: SendNotificationInput): Promise<Result<Notification, DomainError>> {
    const sandbox = input.sandbox === true;
    const requestHash = hashNotificationRequest(input);

    const existing = await this.notifications.findByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
      sandbox,
    );
    if (existing) return this.replay(existing, requestHash);

    const recipient = normalizeNotificationRecipient(input.to);
    if (recipient instanceof DomainError) return err(recipient);

    const phone = await resolveNotificationPhone(this.phones, input.tenantId, input.phoneNumberId);
    if (phone instanceof DomainError) return err(phone);

    const resolved = await this.resolveTemplate(input, phone);
    if (resolved instanceof DomainError) return err(resolved);

    // El opt-out de marketing se conoce antes de crear: si ya dijo que no,
    // no tiene sentido dejar una notificación `failed` en el historial.
    if (resolved.template.category === TemplateCategory.MARKETING) {
      const contact = await this.contacts.findByPhone(input.tenantId, recipient);
      if (contact?.marketingOptedOut) return err(new MarketingOptOutError());
    }

    if (JSON.stringify(input.metadata ?? {}).length > MAX_METADATA_LENGTH) {
      return err(
        new DomainError(
          'INVALID_METADATA',
          `\`metadata\` is too large (max ${MAX_METADATA_LENGTH} characters).`,
        ),
      );
    }

    const sendAt = input.sendAt ? new Date(input.sendAt) : null;
    if (sendAt && Number.isNaN(sendAt.getTime())) {
      return err(new DomainError('INVALID_SEND_AT', '`sendAt` must be a valid ISO 8601 date.'));
    }

    const now = new Date();
    const scheduled = !!sendAt && sendAt.getTime() > now.getTime();

    const notification = new Notification(
      generateNotificationId(),
      input.tenantId,
      phone.id,
      null,
      null,
      null,
      null,
      `+${recipient}`,
      resolved.template.id,
      resolved.template.name,
      resolved.variables,
      scheduled ? NotificationStatus.SCHEDULED : NotificationStatus.QUEUED,
      sendAt,
      scheduled ? null : now,
      null,
      null,
      null,
      null,
      null,
      null,
      input.metadata ?? {},
      input.idempotencyKey,
      requestHash,
      sandbox,
      input.createdByAgentId ?? null,
      now,
      now,
    );

    let created: Notification;
    try {
      created = await this.notifications.create(notification);
    } catch (error) {
      // Otra request con la misma Idempotency-Key ganó la carrera del índice
      // único. No es un error: se devuelve la que ya existe.
      if (isDuplicateKey(error)) {
        const concurrent = await this.notifications.findByIdempotencyKey(
          input.tenantId,
          input.idempotencyKey,
          sandbox,
        );
        if (concurrent) return this.replay(concurrent, requestHash);
      }
      throw error;
    }

    this.devEvents.emit(
      created.tenantId,
      DeveloperEventType.NOTIFICATION_SCHEDULED,
      serializeNotificationPayload(created),
    );

    if (scheduled) {
      await this.queue.schedule(NOTIFICATION_SEND_JOB, { notificationId: created.id }, sendAt!);
    } else {
      await this.queue.enqueue(NOTIFICATION_SEND_JOB, { notificationId: created.id });
    }

    return ok(created);
  }

  /**
   * Misma clave + misma huella = mismo recurso. Misma clave + otra huella es
   * un error: el cliente creyó que reintentaba pero estaba mandando otra cosa.
   */
  private replay(
    existing: Notification,
    requestHash: string,
  ): Result<Notification, DomainError> {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      return err(
        new DomainError(
          'IDEMPOTENCY_KEY_REUSED',
          'This `Idempotency-Key` was already used with a different request body. Use a new key for a new notification.',
        ),
      );
    }
    return ok(existing);
  }

  private async resolveTemplate(
    input: SendNotificationInput,
    phone: PhoneNumber,
  ): Promise<ResolvedTemplate | DomainError> {
    let template: MessageTemplate | null = null;

    if (input.templateId) {
      if (!isObjectIdLike(input.templateId)) {
        return new DomainError('TEMPLATE_NOT_FOUND', 'Template not found.');
      }
      template = await this.templates.findById(input.templateId);
      if (!template || template.tenantId !== input.tenantId) {
        return new DomainError('TEMPLATE_NOT_FOUND', 'Template not found.');
      }
    } else if (input.template) {
      template = await this.templates.findByWabaNameLanguage(
        phone.wabaId,
        input.template.name,
        input.template.language,
      );
      if (!template || template.tenantId !== input.tenantId) {
        return new DomainError(
          'TEMPLATE_NOT_FOUND',
          `Template '${input.template.name}' (${input.template.language}) not found for this WhatsApp account.`,
        );
      }
    } else {
      return new DomainError(
        'TEMPLATE_NOT_FOUND',
        'Provide `templateId` or `template: { name, language }`.',
      );
    }

    if (!templateBelongsToPhone(template, phone)) {
      return new DomainError(
        'TEMPLATE_PHONE_MISMATCH',
        'Template belongs to a different WhatsApp account.',
      );
    }
    if (template.status !== TemplateStatus.APPROVED) {
      return new DomainError(
        'TEMPLATE_NOT_APPROVED',
        `Template '${template.name}' is ${template.status}; only approved templates can be sent.`,
      );
    }

    const canonical = canonicalizeTemplateVariables(template.components, input.variables ?? {});
    if (canonical.missing.length > 0) {
      return new DomainError(
        'MISSING_TEMPLATE_VARIABLES',
        `Missing template variables: ${canonical.missing.join(', ')}`,
      );
    }

    return { template, variables: canonical.variables };
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 11000
  );
}
