import type { RegisteredTool } from './tool-registry.js';
import type { ConversationRepository } from '../../../../domain/repositories/conversation.repository.js';
import type { LabelRepository } from '../../../../domain/repositories/label.repository.js';
import type { ConversationLabelRepository } from '../../../../domain/repositories/conversation-label.repository.js';
import type { ConversationEventRepository } from '../../../../domain/repositories/conversation-event.repository.js';
import type { RealtimeGatewayPort } from '../../../ports/realtime-gateway.port.js';
import { ConversationEventType } from '../../../../domain/enums/conversation-event-type.enum.js';

export function createConversationTools(deps: {
  conversationRepo: ConversationRepository;
  labelRepo: LabelRepository;
  convLabelRepo: ConversationLabelRepository;
  eventRepo: ConversationEventRepository;
  gateway: RealtimeGatewayPort;
}): RegisteredTool[] {
  return [
    // ── handoff_to_human ─────────────────────────────────────────────────
    {
      definition: {
        name: 'handoff_to_human',
        description: 'Transfer the conversation to a human agent. Use when: the customer explicitly asks for a human, the question is outside your knowledge, the customer is frustrated, or the situation requires human judgment.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Why the handoff is needed' },
          },
          required: ['reason'],
        },
      },
      handler: async (args) => {
        // Signal prefix tells ProcessAiResponseUseCase to execute handoff AFTER sending the response.
        // Format: __handoff__:<reason> — reason is stored for internal logging.
        // The LLM will see this tool result and should generate a farewell message.
        const reason = args.reason as string || 'Customer requested human agent';
        return `__handoff__:${reason}`;
      },
    },

    // ── add_label ────────────────────────────────────────────────────────
    {
      definition: {
        name: 'add_label',
        description: 'Add a classification label to this conversation.',
        parameters: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Label name to add' },
          },
          required: ['label'],
        },
      },
      handler: async (args, ctx) => {
        const labelName = args.label as string;
        const tenantLabels = await deps.labelRepo.findByTenantId(ctx.tenantId);
        const label = tenantLabels.find((l: any) => l.name.toLowerCase() === labelName?.toLowerCase());
        if (!label) return `Label "${labelName}" not found. Available labels: ${tenantLabels.map((l: any) => l.name).join(', ')}`;

        try {
          await deps.convLabelRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            labelId: label.id,
            assignedBy: ctx.agentId,
          });
          await deps.eventRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            type: ConversationEventType.LABEL_ADDED,
            performedBy: ctx.agentId,
            data: { agentName: ctx.agentName, labelName: label.name, labelColor: label.color },
          });
          deps.gateway.emitToConversation(ctx.conversationId, 'label.assigned', {
            conversationId: ctx.conversationId,
            label: { id: label.id, name: label.name, color: label.color },
          });
          deps.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversationId });
          return `Label "${label.name}" added`;
        } catch (error: any) {
          return `Error adding label: ${error.message}`;
        }
      },
    },

    // ── remove_label ─────────────────────────────────────────────────────
    {
      definition: {
        name: 'remove_label',
        description: 'Remove a classification label from this conversation.',
        parameters: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Label name to remove' },
          },
          required: ['label'],
        },
      },
      handler: async (args, ctx) => {
        const labelName = args.label as string;
        const tenantLabels = await deps.labelRepo.findByTenantId(ctx.tenantId);
        const label = tenantLabels.find((l: any) => l.name.toLowerCase() === labelName?.toLowerCase());
        if (!label) return `Label "${labelName}" not found`;

        try {
          await deps.convLabelRepo.delete(ctx.conversationId, label.id);
          await deps.eventRepo.create({
            conversationId: ctx.conversationId,
            tenantId: ctx.tenantId,
            type: ConversationEventType.LABEL_REMOVED,
            performedBy: ctx.agentId,
            data: { agentName: ctx.agentName, labelName: label.name, labelColor: label.color },
          });
          deps.gateway.emitToConversation(ctx.conversationId, 'label.removed', {
            conversationId: ctx.conversationId,
            labelId: label.id,
          });
          deps.gateway.emitToTenant(ctx.tenantId, 'conversation.updated', { conversationId: ctx.conversationId });
          return `Label "${label.name}" removed`;
        } catch (error: any) {
          return `Error removing label: ${error.message}`;
        }
      },
    },

    // ── update_conversation_summary ──────────────────────────────────────
    {
      definition: {
        name: 'update_conversation_summary',
        description: 'Update the internal conversation summary to track key information discussed. Use after substantive exchanges.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Brief summary of the conversation so far' },
          },
          required: ['summary'],
        },
      },
      handler: async (args, ctx) => {
        const summary = args.summary as string;
        if (!summary) return 'Error: summary is required';
        await deps.conversationRepo.update(ctx.conversationId, { summary } as any);
        return 'Conversation summary updated';
      },
    },
  ];
}
