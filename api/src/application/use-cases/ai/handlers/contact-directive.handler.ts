import { Logger } from '@nestjs/common';
import { ContactRepository } from '../../../../domain/repositories/contact.repository.js';
import { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../../ports/realtime-gateway.port.js';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';
import type { Directive } from '../../../../domain/services/directive-engine.domain-service.js';

const STANDARD_FIELDS = new Set(['name', 'email', 'company', 'notes']);

export class ContactDirectiveHandler {
  private readonly logger = new Logger(ContactDirectiveHandler.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async handle(
    directives: Directive[],
    contactId: string,
    conversationId: string,
    tenantId: string,
    performedBy: string,
  ): Promise<void> {
    if (directives.length === 0) return;

    const standardUpdates: Record<string, string> = {};
    const customUpdates: Record<string, string> = {};
    const changedFields: string[] = [];

    for (const d of directives) {
      if (d.action !== 'set' || !d.key || !d.value) continue;

      const key = d.key.toLowerCase();

      if (key.startsWith('custom.')) {
        const customKey = d.key.substring(7); // preserve original casing after "custom."
        customUpdates[customKey] = d.value;
        changedFields.push(customKey);
      } else if (STANDARD_FIELDS.has(key)) {
        standardUpdates[key] = d.value;
        changedFields.push(key);
      } else {
        // Unknown field → treat as custom
        customUpdates[d.key] = d.value;
        changedFields.push(d.key);
      }
    }

    if (changedFields.length === 0) return;

    // Merge custom fields with existing ones
    const contact = await this.contactRepo.findById(contactId);
    if (!contact) return;

    const mergedCustomFields = { ...contact.customFields, ...customUpdates };

    const updatePayload: Parameters<typeof this.contactRepo.update>[1] = {};

    if (standardUpdates.name !== undefined) updatePayload.name = standardUpdates.name;
    if (standardUpdates.email !== undefined) updatePayload.email = standardUpdates.email;
    if (standardUpdates.company !== undefined) updatePayload.company = standardUpdates.company;
    if (standardUpdates.notes !== undefined) {
      // Append to existing notes rather than replacing
      updatePayload.notes = contact.notes
        ? `${contact.notes}\n${standardUpdates.notes}`
        : standardUpdates.notes;
    }
    if (Object.keys(customUpdates).length > 0) {
      updatePayload.customFields = mergedCustomFields;
    }

    try {
      await this.contactRepo.update(contactId, updatePayload);

      await this.eventRepo.create({
        conversationId,
        tenantId,
        type: ConversationEventType.CONTACT_UPDATED,
        performedBy,
        data: { fields: changedFields, source: 'ai' },
      });

      this.gateway.emitToConversation(conversationId, 'contact.updated', { contactId, fields: changedFields });
      this.gateway.emitToTenant(tenantId, 'conversation.updated', { conversationId });

      this.logger.log(`AI updated contact ${contactId}: ${changedFields.join(', ')}`);
    } catch (error) {
      this.logger.warn(`Failed to update contact ${contactId}: ${error}`);
    }
  }
}
