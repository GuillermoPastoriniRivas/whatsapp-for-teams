import { Logger } from '@nestjs/common';
import { ContactRepository } from '../../../../domain/repositories/contact.repository.js';
import { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import { RealtimeGatewayPort } from '../../../ports/realtime-gateway.port.js';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';

const STANDARD_FIELDS = new Set(['name', 'email', 'company', 'notes']);

export class ContactDirectiveHandler {
  private readonly logger = new Logger(ContactDirectiveHandler.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly eventRepo: ConversationEventRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async handleAction(
    params: { field: string; value: string },
    contactId: string,
    conversationId: string,
    tenantId: string,
    performedBy: string,
  ): Promise<string> {
    const { field, value } = params;
    if (!field || !value) return 'No field or value provided';

    const key = field.toLowerCase();
    const contact = await this.contactRepo.findById(contactId);
    if (!contact) return 'Contact not found';

    const updatePayload: Parameters<typeof this.contactRepo.update>[1] = {};
    let changedField: string;

    if (key.startsWith('custom.')) {
      const customKey = field.substring(7);
      changedField = customKey;
      updatePayload.customFields = { ...contact.customFields, [customKey]: value };
    } else if (STANDARD_FIELDS.has(key)) {
      changedField = key;
      if (key === 'notes') {
        updatePayload.notes = contact.notes ? `${contact.notes}\n${value}` : value;
      } else {
        (updatePayload as any)[key] = value;
      }
    } else {
      changedField = field;
      updatePayload.customFields = { ...contact.customFields, [field]: value };
    }

    try {
      await this.contactRepo.update(contactId, updatePayload);

      await this.eventRepo.create({
        conversationId,
        tenantId,
        type: ConversationEventType.CONTACT_UPDATED,
        performedBy,
        data: { fields: [changedField], source: 'ai' },
      });

      this.gateway.emitToConversation(conversationId, 'contact.updated', { contactId, fields: [changedField] });
      this.gateway.emitToTenant(tenantId, 'conversation.updated', { conversationId });

      this.logger.log(`AI updated contact ${contactId}: ${changedField}`);
      return `Contact ${changedField} updated to "${value}"`;
    } catch (error) {
      this.logger.warn(`Failed to update contact ${contactId}: ${error}`);
      throw error;
    }
  }
}
