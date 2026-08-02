import { Message } from '../../../domain/entities/message.entity.js';
import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { serializeMessage } from '../developer/developer-payloads.util.js';
import { SendMessageInput } from '../../dtos/conversation/send-message-input.dto.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, ConversationNotFoundError, AgentNotAssignedError, ConversationWindowExpiredError } from '../../../domain/errors/domain-errors.js';
import { MediaNotFoundError, MediaUnavailableError } from '../../../domain/errors/media-errors.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaAccessService } from '../media/media-access.service.js';
import { MessageMediaEnricher } from '../media/message-media.enricher.js';
import { CancelActiveFlowExecutionUseCase } from '../flow/cancel-active-flow-execution.use-case.js';

/** El tipo de mensaje de WhatsApp que corresponde a cada clase de archivo. */
const MEDIA_MESSAGE_TYPES: Record<MediaKind, MessageType> = {
  [MediaKind.IMAGE]: MessageType.IMAGE,
  [MediaKind.VIDEO]: MessageType.VIDEO,
  [MediaKind.AUDIO]: MessageType.AUDIO,
  [MediaKind.DOCUMENT]: MessageType.DOCUMENT,
  [MediaKind.STICKER]: MessageType.STICKER,
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class SendMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly contactRepo: ContactRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly messagingApi: MessagingApiPort,
    private readonly gateway: RealtimeGatewayPort,
    private readonly agentRepo: AgentRepository,
    private readonly cancelActiveFlow: CancelActiveFlowExecutionUseCase,
    private readonly devEvents: DeveloperEventsPort,
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
    private readonly mediaEnricher: MessageMediaEnricher,
  ) {}

  async execute(input: SendMessageInput): Promise<Result<Message, DomainError>> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) return err(new ConversationNotFoundError());

    if (conversation.agentId !== input.agentId) return err(new AgentNotAssignedError());

    // 24h window check
    const elapsed = Date.now() - conversation.lastInboundAt.getTime();
    if (elapsed >= TWENTY_FOUR_HOURS_MS) return err(new ConversationWindowExpiredError());

    const contact = await this.contactRepo.findById(conversation.contactId);
    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone || phone.status !== 'active') {
      return err(new DomainError('PHONE_NUMBER_INACTIVE', 'This phone number is currently inactive.'));
    }
    const agent = await this.agentRepo.findById(input.agentId);

    // Con adjunto, el archivo define el tipo de mensaje y el texto pasa a ser
    // el caption. Se envía siempre por media_id: no expone ninguna URL y saca
    // del medio los fallos de "Meta no pudo descargar tu link".
    let asset: MediaAsset | null = null;
    let mediaId: string | undefined;
    let messageType = input.messageType ?? MessageType.TEXT;

    if (input.mediaAssetId) {
      asset = await this.assetRepo.findById(input.mediaAssetId);
      if (!asset || asset.tenantId !== conversation.tenantId || asset.deletedAt) {
        return err(new MediaNotFoundError());
      }
      if (asset.isUnavailable()) return err(new MediaUnavailableError());

      messageType = MEDIA_MESSAGE_TYPES[asset.kind];
      ({ mediaId } = await this.mediaAccess.resolveSendRef(asset, phone));
    }

    const { waMessageId } = await this.messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      to: contact!.waId,
      type: messageType,
      body: input.body,
      mediaId,
      filename: asset?.filename ?? undefined,
    });

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      messageType,
      body: input.body,
      mediaUrl: null,
      mimeType: asset?.mimeType ?? null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: input.agentId,
      senderAgentName: agent?.name ?? null,
      mediaAssetId: asset?.id ?? null,
    });

    // El asset no se toca: uno de biblioteca se manda a muchos contactos, así
    // que atarlo a un mensaje sería mentira. El vínculo vive en el Message.
    const enriched = await this.mediaEnricher.one(message);

    await this.conversationRepo.update(conversation.id, { lastMessageAt: new Date() } as any);

    // El humano siempre gana: si un flujo estaba manejando la conversación,
    // escribir la detiene (nunca dos escritores hablándole al cliente). Va
    // DESPUÉS del envío: un intento fallido (ventana vencida, error del
    // proveedor) no llegó al cliente y no debe matar la automatización.
    await this.cancelActiveFlow.execute(conversation.id, 'agent_takeover', input.agentId);

    this.gateway.emitToConversation(conversation.id, 'message.new', enriched);

    this.devEvents.emit(conversation.tenantId, DeveloperEventType.MESSAGE_SENT, {
      message: serializeMessage(message),
      conversationId: conversation.id,
      via: 'agent',
    });

    return ok(enriched);
  }
}
