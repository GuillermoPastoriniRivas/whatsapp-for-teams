import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContactMergeRepository } from '../../../../domain/repositories/contact.repository.js';
import { ContactModel, ContactDocument } from '../schemas/contact.schema.js';
import { ConversationModel, ConversationDocument } from '../schemas/conversation.schema.js';
import { MessageModel, MessageDocument } from '../schemas/message.schema.js';
import { ConversationEventModel, ConversationEventDocument } from '../schemas/conversation-event.schema.js';
import { ConversationNoteModel, ConversationNoteDocument } from '../schemas/conversation-note.schema.js';
import { ConversationLabelModel, ConversationLabelDocument } from '../schemas/conversation-label.schema.js';
import { CampaignRecipientModel, CampaignRecipientDocument } from '../schemas/campaign-recipient.schema.js';
import { FlowExecutionModel, FlowExecutionDocument } from '../schemas/flow-execution.schema.js';
import { MediaAssetModel, MediaAssetDocument } from '../schemas/media-asset.schema.js';

/**
 * Fusiona dos contactos que resultaron ser la misma persona.
 *
 * Pasa cuando un contacto que conocíamos solo por BSUID revela su teléfono (vía
 * `REQUEST_CONTACT_INFO` o el contact book de Meta) y ya existía otro contacto
 * con ese número creado por CSV, campaña o API.
 *
 * Es idempotente a propósito: Meta reentrega webhooks, así que el merge se
 * puede ejecutar dos veces sobre el mismo par sin duplicar ni romper nada.
 */
@Injectable()
export class MongoContactMergeRepository implements ContactMergeRepository {
  private readonly logger = new Logger(MongoContactMergeRepository.name);

  constructor(
    @InjectModel(ContactModel.name) private readonly contacts: Model<ContactDocument>,
    @InjectModel(ConversationModel.name) private readonly conversations: Model<ConversationDocument>,
    @InjectModel(MessageModel.name) private readonly messages: Model<MessageDocument>,
    @InjectModel(ConversationEventModel.name) private readonly events: Model<ConversationEventDocument>,
    @InjectModel(ConversationNoteModel.name) private readonly notes: Model<ConversationNoteDocument>,
    @InjectModel(ConversationLabelModel.name) private readonly labels: Model<ConversationLabelDocument>,
    @InjectModel(CampaignRecipientModel.name) private readonly recipients: Model<CampaignRecipientDocument>,
    @InjectModel(FlowExecutionModel.name) private readonly executions: Model<FlowExecutionDocument>,
    @InjectModel(MediaAssetModel.name) private readonly media: Model<MediaAssetDocument>,
  ) {}

  async merge(survivorId: string, duplicateId: string): Promise<void> {
    if (survivorId === duplicateId) return;

    const survivor = new Types.ObjectId(survivorId);
    const duplicate = new Types.ObjectId(duplicateId);

    await this.mergeConversations(survivor, duplicate);
    await this.mergeCampaignRecipients(survivor, duplicate);

    // Sin índices únicos por contacto: se reapuntan en bloque.
    await this.executions.updateMany({ contactId: duplicate }, { $set: { contactId: survivor } });
    await this.media.updateMany({ contactId: duplicate }, { $set: { contactId: survivor } });

    await this.mergeContactFields(survivor, duplicate);
    await this.contacts.findByIdAndDelete(duplicate);

    this.logger.log(`Contacto ${duplicateId} fusionado dentro de ${survivorId}`);
  }

  /**
   * `(contactId, phoneNumberId)` es único, así que una conversación del
   * duplicado no siempre se puede reapuntar: si el sobreviviente ya tiene una
   * sobre el mismo número, hay que volcarle el contenido y borrar la vacía.
   */
  private async mergeConversations(survivor: Types.ObjectId, duplicate: Types.ObjectId): Promise<void> {
    const orphaned = await this.conversations.find({ contactId: duplicate });

    for (const conv of orphaned) {
      const target = await this.conversations.findOne({
        contactId: survivor,
        phoneNumberId: conv.phoneNumberId,
      });

      if (!target) {
        await this.conversations.updateOne({ _id: conv._id }, { $set: { contactId: survivor } });
        continue;
      }

      await Promise.all([
        this.messages.updateMany({ conversationId: conv._id }, { $set: { conversationId: target._id } }),
        this.events.updateMany({ conversationId: conv._id }, { $set: { conversationId: target._id } }),
        this.notes.updateMany({ conversationId: conv._id }, { $set: { conversationId: target._id } }),
      ]);

      // `(conversationId, labelId)` también es único: las etiquetas que el
      // destino ya tiene se descartan en vez de moverse.
      const movedLabels = await this.labels.find({ conversationId: conv._id });
      for (const label of movedLabels) {
        const clash = await this.labels.findOne({ conversationId: target._id, labelId: label.labelId });
        if (clash) await this.labels.findByIdAndDelete(label._id);
        else await this.labels.updateOne({ _id: label._id }, { $set: { conversationId: target._id } });
      }

      await this.conversations.updateOne(
        { _id: target._id },
        {
          $set: {
            lastMessageAt: newer(target.lastMessageAt, conv.lastMessageAt),
            lastInboundAt: newer(target.lastInboundAt, conv.lastInboundAt),
            createdAt: older(target.createdAt, conv.createdAt),
          },
          $inc: { unreadCount: conv.unreadCount ?? 0 },
        },
      );

      await this.conversations.findByIdAndDelete(conv._id);
    }
  }

  /** `(campaignId, contactId)` es único: si ya hay fila para el sobreviviente, se descarta la del duplicado. */
  private async mergeCampaignRecipients(survivor: Types.ObjectId, duplicate: Types.ObjectId): Promise<void> {
    const rows = await this.recipients.find({ contactId: duplicate });

    for (const row of rows) {
      const clash = await this.recipients.findOne({ campaignId: row.campaignId, contactId: survivor });
      if (clash) await this.recipients.findByIdAndDelete(row._id);
      else await this.recipients.updateOne({ _id: row._id }, { $set: { contactId: survivor } });
    }
  }

  /** El sobreviviente manda; del duplicado solo se toman los campos que le faltan. */
  private async mergeContactFields(survivor: Types.ObjectId, duplicate: Types.ObjectId): Promise<void> {
    const [target, source] = await Promise.all([
      this.contacts.findById(survivor),
      this.contacts.findById(duplicate),
    ]);
    if (!target || !source) return;

    const set: Record<string, unknown> = {};
    for (const field of ['phone', 'bsuid', 'parentBsuid', 'username', 'portfolioId', 'email', 'company', 'notes', 'profilePicUrl'] as const) {
      if (!target[field] && source[field]) set[field] = source[field];
    }
    if (!target.name?.trim() && source.name?.trim()) set.name = source.name;
    set.lastSeenAt = newer(target.lastSeenAt, source.lastSeenAt);
    set.customFields = { ...(source.customFields ?? {}), ...(target.customFields ?? {}) };

    await this.contacts.updateOne({ _id: survivor }, { $set: set });
  }
}

function newer(a: Date, b: Date): Date {
  return a && b ? (a > b ? a : b) : (a ?? b);
}

function older(a: Date, b: Date): Date {
  return a && b ? (a < b ? a : b) : (a ?? b);
}
