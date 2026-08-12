import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import type { ApiScope } from '../../domain/value-objects/api-scopes.js';
import { FlowGraphSchema } from '../request-dtos/flow-request.dto.js';
import { SendApiMessageUseCase } from '../../application/use-cases/developer/send-api-message.use-case.js';
import { CreateContactUseCase } from '../../application/use-cases/contact/create-contact.use-case.js';
import { CreateLabelUseCase } from '../../application/use-cases/label/create-label.use-case.js';
import { UpdateLabelUseCase } from '../../application/use-cases/label/update-label.use-case.js';
import { LABEL_COLORS } from '../../domain/value-objects/label-colors.js';
import { CreateFlowUseCase } from '../../application/use-cases/flow/create-flow.use-case.js';
import { ListFlowsUseCase } from '../../application/use-cases/flow/list-flows.use-case.js';
import { GetFlowUseCase } from '../../application/use-cases/flow/get-flow.use-case.js';
import { UpdateFlowUseCase } from '../../application/use-cases/flow/update-flow.use-case.js';
import { CheckFlowUseCase } from '../../application/use-cases/flow/check-flow.use-case.js';
import { SimulateFlowUseCase } from '../../application/use-cases/flow/simulator/simulate-flow.use-case.js';
import {
  serializeMessage, serializeConversation, serializeContact,
} from '../../application/use-cases/developer/developer-payloads.util.js';
import {
  NODE_TYPES, TRIGGER_TYPES, outputHandles, isTrigger, isTerminal,
} from '../../application/use-cases/flow/engine/flow-node-types.js';
import {
  WHATSAPP_COMPONENT_LIMITS, WHATSAPP_COMPONENT_LIMIT_NOTES,
} from '../../application/use-cases/flow/engine/whatsapp-component-limits.js';
import {
  FLOW_NODE_DATA_SCHEMA, FLOW_NODE_DATA_SCHEMA_NOTES,
} from '../../application/use-cases/flow/engine/flow-node-data-schema.js';
import { API_SCOPE_DESCRIPTIONS } from '../../domain/value-objects/api-scopes.js';
import { TemplateStatus } from '../../domain/enums/template-status.enum.js';
import { AgentType } from '../../domain/enums/agent-type.enum.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';
import type { MessageRepository } from '../../domain/repositories/message.repository.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';
import type { MessageTemplateRepository } from '../../domain/repositories/message-template.repository.js';
import type { LabelRepository } from '../../domain/repositories/label.repository.js';
import type { FlowConnectionRepository } from '../../domain/repositories/flow-connection.repository.js';
import type { ConversationStatus } from '../../domain/enums/conversation-status.enum.js';

export const MCP_SERVER_NAME = 'asis-chat';
export const MCP_SERVER_VERSION = '1.0.0';

const DYNAMIC_OUTPUT_TYPES = new Set(['action.send_buttons', 'action.send_list', 'logic.ai_route']);
const TEMPLATES_SUGGESTED_ON_CLOSED_WINDOW = 10;

type ToolReply = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function asJson(value: unknown): ToolReply {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function asProblem(text: string): ToolReply {
  return { isError: true, content: [{ type: 'text', text }] };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const READ_ONLY_REMOTE = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;
const REACHES_REAL_CUSTOMERS = { readOnlyHint: false, destructiveHint: true, openWorldHint: true } as const;
const SAFE_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const IDEMPOTENT_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const REPLACES_EXISTING_DRAFT = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

@Injectable()
export class AsisMcpServerFactory {
  constructor(
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
    @Inject('ConversationRepository') private readonly conversationRepo: ConversationRepository,
    @Inject('MessageRepository') private readonly messageRepo: MessageRepository,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
    @Inject('MessageTemplateRepository') private readonly templateRepo: MessageTemplateRepository,
    @Inject('AgentRepository') private readonly agentRepo: AgentRepository,
    @Inject('LabelRepository') private readonly labelRepo: LabelRepository,
    @Inject('FlowConnectionRepository') private readonly connectionRepo: FlowConnectionRepository,
    @Inject('SendApiMessageUseCase') private readonly sendApiMessage: SendApiMessageUseCase,
    @Inject('CreateContactUseCase') private readonly createContact: CreateContactUseCase,
    @Inject('CreateLabelUseCase') private readonly createLabel: CreateLabelUseCase,
    @Inject('UpdateLabelUseCase') private readonly updateLabel: UpdateLabelUseCase,
    @Inject('CreateFlowUseCase') private readonly createFlow: CreateFlowUseCase,
    @Inject('ListFlowsUseCase') private readonly listFlows: ListFlowsUseCase,
    @Inject('GetFlowUseCase') private readonly getFlow: GetFlowUseCase,
    @Inject('UpdateFlowUseCase') private readonly updateFlow: UpdateFlowUseCase,
    @Inject('CheckFlowUseCase') private readonly checkFlow: CheckFlowUseCase,
    @Inject('SimulateFlowUseCase') private readonly simulateFlow: SimulateFlowUseCase,
  ) {}

  create(principal: ApiKeyPrincipal): McpServer {
    const server = new McpServer(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      {
        instructions:
          'asis.chat runs WhatsApp for a business through the official Meta Cloud API. ' +
          'Read the asis://whatsapp/component-limits and asis://automations/node-types resources before building an automation: ' +
          'they carry the channel limits that Meta enforces and the exact node types the engine accepts. ' +
          'Automations built here are always drafts. Publishing is deliberately unavailable to assistants: ' +
          'a live automation speaks to real customers from the business phone number, so a human makes that call in the app.',
      },
    );

    this.registerCatalogResources(server);
    this.registerMessagingTools(server, principal);
    this.registerBuildingBlockTools(server, principal);
    this.registerAutomationTools(server, principal);
    this.registerAuthoringPrompts(server);
    return server;
  }

  private lacksEveryScope(principal: ApiKeyPrincipal, scopes: ApiScope[]): ToolReply | null {
    if (scopes.some((scope) => principal.scopes.includes(scope))) return null;
    return this.lacksScope(principal, scopes[0]);
  }

  private lacksScope(principal: ApiKeyPrincipal, scope: ApiScope): ToolReply | null {
    if (principal.scopes.includes(scope)) return null;
    return asProblem(
      `This API key does not have the "${scope}" permission (${API_SCOPE_DESCRIPTIONS[scope]}). ` +
        `It currently grants: ${principal.scopes.join(', ') || 'nothing'}. ` +
        'The account owner can create a key with that permission from Developers in the asis.chat app. ' +
        'Do not retry this tool with the same key.',
    );
  }

  private registerCatalogResources(server: McpServer): void {
    server.registerResource(
      'whatsapp-component-limits',
      'asis://whatsapp/component-limits',
      {
        title: 'WhatsApp component limits',
        description:
          'Hard limits WhatsApp enforces on interactive components (buttons, lists, captions, URLs). ' +
          'Read this before writing any message content so a draft is not rejected by Meta.',
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              { limits: WHATSAPP_COMPONENT_LIMITS, notes: WHATSAPP_COMPONENT_LIMIT_NOTES },
              null,
              2,
            ),
          },
        ],
      }),
    );

    server.registerResource(
      'automation-node-types',
      'asis://automations/node-types',
      {
        title: 'Automation node catalog',
        description:
          'Every node type the automation engine accepts: the fields its data object takes, and the output handles ' +
          'an edge may start from. Nodes flagged dynamicOutputs derive their handles from their own configuration.',
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                notes: FLOW_NODE_DATA_SCHEMA_NOTES,
                triggers: [...TRIGGER_TYPES],
                nodeTypes: NODE_TYPES.map((type) => ({
                  type,
                  trigger: isTrigger(type),
                  terminal: isTerminal(type),
                  outputs: outputHandles({ id: 'sample', type, position: { x: 0, y: 0 }, data: {} } as never),
                  dynamicOutputs: DYNAMIC_OUTPUT_TYPES.has(type),
                  fields: FLOW_NODE_DATA_SCHEMA[type] ?? [],
                })),
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }

  private async approvedTemplateSuggestions(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const templates = await this.templateRepo.findByFilters({
      tenantId,
      status: TemplateStatus.APPROVED,
      page: 1,
      limit: TEMPLATES_SUGGESTED_ON_CLOSED_WINDOW,
    });
    return templates.data.map((template) => ({
      templateId: template.id,
      name: template.name,
      language: template.language,
      phoneNumberId: template.phoneNumberId,
    }));
  }

  private async explainSendFailure(tenantId: string, error: DomainError): Promise<ToolReply> {
    if (error.code !== 'CONVERSATION_WINDOW_EXPIRED') {
      return asProblem(`${error.code}: ${error.message}`);
    }
    const templates = await this.approvedTemplateSuggestions(tenantId);
    if (templates.length === 0) {
      return asProblem(
        'CONVERSATION_WINDOW_EXPIRED: this contact last wrote more than 24 hours ago, so WhatsApp only accepts an ' +
          'approved message template. This account has no approved template yet, so the message cannot be delivered. ' +
          'The account owner has to create one in the app and wait for Meta to approve it. Do not retry with free-form text.',
      );
    }
    return asProblem(
      'CONVERSATION_WINDOW_EXPIRED: this contact last wrote more than 24 hours ago. WhatsApp only accepts an approved ' +
        'message template outside that window. Call this tool again passing templateId (plus variables if the template ' +
        'has placeholders) instead of body. Approved templates available:\n' +
        JSON.stringify(templates, null, 2),
    );
  }

  private registerMessagingTools(server: McpServer, principal: ApiKeyPrincipal): void {
    server.registerTool(
      'list_phone_numbers',
      {
        title: 'List WhatsApp numbers',
        description:
          'WhatsApp numbers connected to this account. Use the returned id as phoneNumberId when sending a message ' +
          'or when scoping an automation to a specific line.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const phones = await this.phoneRepo.findByTenantId(principal.tenantId);
        return asJson(
          phones.map((phone) => ({
            id: phone.id,
            label: phone.label,
            displayPhone: phone.displayPhone,
            status: phone.status,
          })),
        );
      },
    );

    server.registerTool(
      'list_message_templates',
      {
        title: 'List approved templates',
        description:
          'Approved WhatsApp templates. A template is the only thing that can be sent to a contact whose 24-hour ' +
          'customer service window has closed.',
        inputSchema: { limit: z.number().int().min(1).max(100).default(50) },
        annotations: READ_ONLY,
      },
      async ({ limit }) => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const result = await this.templateRepo.findByFilters({
          tenantId: principal.tenantId,
          status: TemplateStatus.APPROVED,
          page: 1,
          limit,
        });
        return asJson(
          result.data.map((template) => ({
            id: template.id,
            name: template.name,
            language: template.language,
            category: template.category,
            phoneNumberId: template.phoneNumberId,
            components: template.components,
          })),
        );
      },
    );

    server.registerTool(
      'list_conversations',
      {
        title: 'List conversations',
        description: 'Conversations of the account, most recently active first.',
        inputSchema: {
          status: z.enum(['unassigned', 'active']).optional(),
          phoneNumberId: z.string().optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        },
        annotations: READ_ONLY,
      },
      async ({ status, phoneNumberId, page, limit }) => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const result = await this.conversationRepo.findByFilters({
          tenantId: principal.tenantId,
          status: status as ConversationStatus | undefined,
          phoneNumberId: phoneNumberId || undefined,
          view: 'all',
          page,
          limit,
        });
        return asJson({ data: result.data.map(serializeConversation), meta: result.meta });
      },
    );

    server.registerTool(
      'get_conversation',
      {
        title: 'Get a conversation',
        description: 'A single conversation with the contact behind it.',
        inputSchema: { conversationId: z.string() },
        annotations: READ_ONLY,
      },
      async ({ conversationId }) => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const conversation = await this.conversationRepo.findById(conversationId);
        if (!conversation || conversation.tenantId !== principal.tenantId) {
          return asProblem('CONVERSATION_NOT_FOUND: no conversation with that id belongs to this account.');
        }
        const contact = await this.contactRepo.findById(conversation.contactId);
        return asJson({
          ...serializeConversation(conversation),
          contact: contact ? serializeContact(contact) : null,
        });
      },
    );

    server.registerTool(
      'list_conversation_messages',
      {
        title: 'Read the messages of a conversation',
        description:
          'Message history of one conversation. This is the raw material for turning a real conversation into an ' +
          'automation: read what customers actually ask before designing the flow.',
        inputSchema: {
          conversationId: z.string(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(50),
        },
        annotations: READ_ONLY,
      },
      async ({ conversationId, page, limit }) => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const conversation = await this.conversationRepo.findById(conversationId);
        if (!conversation || conversation.tenantId !== principal.tenantId) {
          return asProblem('CONVERSATION_NOT_FOUND: no conversation with that id belongs to this account.');
        }
        const result = await this.messageRepo.findByConversationId(conversationId, page, limit);
        return asJson({ data: result.data.map(serializeMessage), meta: result.meta });
      },
    );

    server.registerTool(
      'search_contacts',
      {
        title: 'Search contacts',
        description: 'Find contacts of the account by name or phone number.',
        inputSchema: {
          search: z.string().optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(50),
        },
        annotations: READ_ONLY,
      },
      async ({ search, page, limit }) => {
        const denied = this.lacksScope(principal, 'messages:read');
        if (denied) return denied;
        const result = await this.contactRepo.findByTenantId(principal.tenantId, {
          search: search || undefined,
          page,
          limit,
        });
        return asJson({ data: result.data.map(serializeContact), meta: result.meta });
      },
    );

    server.registerTool(
      'create_contact',
      {
        title: 'Create a contact',
        description: 'Find or create a contact by phone number. An existing contact is returned untouched.',
        inputSchema: { phone: z.string(), name: z.string().optional() },
        annotations: IDEMPOTENT_WRITE,
      },
      async ({ phone, name }) => {
        const denied = this.lacksScope(principal, 'messages:write');
        if (denied) return denied;
        const result = await this.createContact.execute({ tenantId: principal.tenantId, phone, name });
        if (!result.ok) {
          const error = result.error as DomainError;
          return asProblem(`${error.code}: ${error.message}`);
        }
        return asJson(serializeContact(result.value));
      },
    );

    server.registerTool(
      'send_whatsapp_message',
      {
        title: 'Send a WhatsApp message',
        description:
          'Sends a real WhatsApp message from the business number to a real person, creating the contact and the ' +
          'conversation if needed. This is not a simulation and cannot be undone. Free-form body only works while the ' +
          '24-hour customer service window is open; outside it, pass templateId of an approved template. ' +
          'To test an automation without reaching anyone, use simulate_automation instead.',
        inputSchema: {
          to: z.string().describe('Recipient phone number in international format'),
          body: z.string().optional().describe('Free-form text. Requires the 24-hour window to be open.'),
          templateId: z.string().optional().describe('Approved template. Works at any time.'),
          variables: z.record(z.string(), z.string()).optional(),
          phoneNumberId: z.string().optional().describe('Sending line. Required when the account has several.'),
          contactName: z.string().optional(),
        },
        annotations: REACHES_REAL_CUSTOMERS,
      },
      async ({ to, body, templateId, variables, phoneNumberId, contactName }) => {
        const denied = this.lacksScope(principal, 'messages:write');
        if (denied) return denied;
        if (!body && !templateId) {
          return asProblem(
            'Provide body (free-form text, only inside the 24-hour window) or templateId (an approved template, valid ' +
              'at any time). Call list_message_templates to see what is approved for this account.',
          );
        }
        const result = await this.sendApiMessage.execute({
          tenantId: principal.tenantId,
          to,
          phoneNumberId,
          contactName,
          body,
          templateId,
          variables,
        });
        if (!result.ok) return this.explainSendFailure(principal.tenantId, result.error as DomainError);
        return asJson(result.value);
      },
    );

    server.registerTool(
      'reply_in_conversation',
      {
        title: 'Reply in an existing conversation',
        description:
          'Sends a real free-form WhatsApp message inside an existing conversation. This reaches a real person and ' +
          'cannot be undone. Only works while the 24-hour customer service window is open.',
        inputSchema: { conversationId: z.string(), body: z.string() },
        annotations: REACHES_REAL_CUSTOMERS,
      },
      async ({ conversationId, body }) => {
        const denied = this.lacksScope(principal, 'messages:write');
        if (denied) return denied;
        const conversation = await this.conversationRepo.findById(conversationId);
        if (!conversation || conversation.tenantId !== principal.tenantId) {
          return asProblem('CONVERSATION_NOT_FOUND: no conversation with that id belongs to this account.');
        }
        const contact = await this.contactRepo.findById(conversation.contactId);
        if (!contact) return asProblem('CONTACT_NOT_FOUND: the contact behind this conversation no longer exists.');
        const result = await this.sendApiMessage.execute({
          tenantId: principal.tenantId,
          contactId: contact.id,
          phoneNumberId: conversation.phoneNumberId,
          body,
        });
        if (!result.ok) return this.explainSendFailure(principal.tenantId, result.error as DomainError);
        return asJson(result.value);
      },
    );
  }

  private async authorFor(principal: ApiKeyPrincipal): Promise<string | null> {
    if (principal.createdByAgentId) return principal.createdByAgentId;
    const agents = await this.agentRepo.findByTenantId(principal.tenantId);
    const admin = agents.find((agent) => agent.role === 'admin' && agent.type === AgentType.HUMAN);
    return admin?.id ?? agents.find((agent) => agent.type === AgentType.HUMAN)?.id ?? null;
  }

  private registerBuildingBlockTools(server: McpServer, principal: ApiKeyPrincipal): void {
    const readsEither: ApiScope[] = ['flows:read', 'messages:read'];
    const writesEither: ApiScope[] = ['flows:write', 'messages:write'];

    server.registerTool(
      'list_labels',
      {
        title: 'List conversation labels',
        description:
          'Labels that exist in this account. The label node only accepts one of these ids. If the one you need is ' +
          'missing, create it with create_label.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => {
        const denied = this.lacksEveryScope(principal, readsEither);
        if (denied) return denied;
        const labels = await this.labelRepo.findByTenantId(principal.tenantId);
        return asJson(labels.map((label) => ({ id: label.id, name: label.name, color: label.color })));
      },
    );

    server.registerTool(
      'create_label',
      {
        title: 'Create a conversation label',
        description:
          'Creates a label the whole account will see, in the inbox and in the label node of any automation. ' +
          'Names are unique: creating one that already exists fails, so call list_labels first. ' +
          'Keep the name short — it is shown as a chip next to the conversation.',
        inputSchema: {
          name: z.string().min(1).max(50),
          color: z.enum(LABEL_COLORS),
        },
        annotations: SAFE_WRITE,
      },
      async ({ name, color }) => {
        const denied = this.lacksEveryScope(principal, writesEither);
        if (denied) return denied;
        const result = await this.createLabel.execute({ tenantId: principal.tenantId, name, color });
        if (!result.ok) {
          return asProblem(
            `${result.error.code}: ${result.error.message} Call list_labels to see what already exists.`,
          );
        }
        return asJson({ id: result.value.id, name: result.value.name, color: result.value.color });
      },
    );

    server.registerTool(
      'update_label',
      {
        title: 'Rename a label or change its colour',
        description:
          'Changes the name or the colour of an existing label. The change reaches every conversation already ' +
          'carrying it and every automation that uses it, so renaming is not a local edit.',
        inputSchema: {
          labelId: z.string(),
          name: z.string().min(1).max(50).optional(),
          color: z.enum(LABEL_COLORS).optional(),
        },
        annotations: REPLACES_EXISTING_DRAFT,
      },
      async ({ labelId, name, color }) => {
        const denied = this.lacksEveryScope(principal, writesEither);
        if (denied) return denied;
        if (!name && !color) return asProblem('Pass a new name, a new colour, or both.');
        const result = await this.updateLabel.execute({ labelId, tenantId: principal.tenantId, name, color });
        if (!result.ok) return asProblem(`${result.error.code}: ${result.error.message}`);
        return asJson({ id: result.value.id, name: result.value.name, color: result.value.color });
      },
    );

    server.registerTool(
      'list_team_agents',
      {
        title: 'List the people on the team',
        description:
          'Human agents of the account. Use their id when an automation assigns a conversation to someone specific.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => {
        const denied = this.lacksEveryScope(principal, readsEither);
        if (denied) return denied;
        const agents = await this.agentRepo.findByTenantId(principal.tenantId);
        return asJson(
          agents
            .filter((agent) => agent.type === AgentType.HUMAN)
            .map((agent) => ({ id: agent.id, name: agent.name, role: agent.role })),
        );
      },
    );

    server.registerTool(
      'list_http_connections',
      {
        title: 'List saved HTTP connections',
        description:
          'Connections that carry a stored secret header, so an automation can call an external system without the ' +
          'credential living in the graph. The secret itself is never readable from here.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => {
        const denied = this.lacksScope(principal, 'flows:read');
        if (denied) return denied;
        const connections = await this.connectionRepo.findByTenantId(principal.tenantId);
        return asJson(
          connections.map((connection) => ({
            id: connection.id,
            name: connection.name,
            headerName: connection.headerName,
          })),
        );
      },
    );
  }

  private registerAutomationTools(server: McpServer, principal: ApiKeyPrincipal): void {
    server.registerTool(
      'list_automations',
      {
        title: 'List automations',
        description: 'Automations of the account, with their publish status.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => {
        const denied = this.lacksScope(principal, 'flows:read');
        if (denied) return denied;
        const flows = await this.listFlows.execute(principal.tenantId);
        return asJson(
          flows.map((flow) => ({
            id: flow.id,
            name: flow.name,
            description: flow.description,
            status: flow.status,
            publishedVersion: flow.publishedVersion,
            priority: flow.priority,
            updatedAt: flow.updatedAt,
          })),
        );
      },
    );

    server.registerTool(
      'get_automation',
      {
        title: 'Get an automation with its draft graph',
        description: 'The full draft graph of one automation: nodes, their configuration and the edges between them.',
        inputSchema: { automationId: z.string() },
        annotations: READ_ONLY,
      },
      async ({ automationId }) => {
        const denied = this.lacksScope(principal, 'flows:read');
        if (denied) return denied;
        const result = await this.getFlow.execute(principal.tenantId, automationId);
        if (!result.ok) return asProblem(`${result.error.code}: ${result.error.message}`);
        const { flow, publishedVersion } = result.value;
        return asJson({
          id: flow.id,
          name: flow.name,
          description: flow.description,
          status: flow.status,
          draftGraph: flow.draftGraph,
          publishedVersion: publishedVersion ? { id: publishedVersion.id, version: publishedVersion.version } : null,
        });
      },
    );

    server.registerTool(
      'create_automation',
      {
        title: 'Create an automation draft',
        description:
          'Creates an empty automation draft. The draft is never live: it does not talk to anyone until a human ' +
          'publishes it from the asis.chat app.',
        inputSchema: {
          name: z.string().min(1).max(80),
          description: z.string().max(300).optional(),
          phoneScope: z.enum(['all', 'specific']).optional(),
          phoneNumberIds: z.array(z.string()).max(50).optional(),
        },
        annotations: SAFE_WRITE,
      },
      async ({ name, description, phoneScope, phoneNumberIds }) => {
        const denied = this.lacksScope(principal, 'flows:write');
        if (denied) return denied;
        const author = await this.authorFor(principal);
        if (!author) {
          return asProblem('NO_AUTHOR: the account has no human agent to attribute the automation to.');
        }
        const result = await this.createFlow.execute({
          tenantId: principal.tenantId,
          createdByAgentId: author,
          name,
          description,
          phoneScope,
          phoneNumberIds,
        });
        if (!result.ok) return asProblem(`${result.error.code}: ${result.error.message}`);
        return asJson(result.value);
      },
    );

    server.registerTool(
      'update_automation_graph',
      {
        title: 'Replace the draft graph of an automation',
        description:
          'Replaces the whole draft graph, discarding whatever the draft held before. Read asis://automations/node-types ' +
          'for the valid node types and their output handles, and asis://whatsapp/component-limits for the content limits. ' +
          'Always call check_automation afterwards: it reports what a human would hit when publishing.',
        inputSchema: {
          automationId: z.string(),
          draftGraph: FlowGraphSchema,
          name: z.string().min(1).max(80).optional(),
          description: z.string().max(300).nullable().optional(),
        },
        annotations: REPLACES_EXISTING_DRAFT,
      },
      async ({ automationId, draftGraph, name, description }) => {
        const denied = this.lacksScope(principal, 'flows:write');
        if (denied) return denied;
        const result = await this.updateFlow.execute({
          tenantId: principal.tenantId,
          flowId: automationId,
          name,
          description,
          draftGraph: draftGraph as never,
        });
        if (!result.ok) {
          const invalid = result.error as DomainError & { errors?: unknown };
          return asProblem(
            `${invalid.code}: ${invalid.message}` +
              (invalid.errors ? `\n${JSON.stringify(invalid.errors, null, 2)}` : ''),
          );
        }
        return asJson(result.value);
      },
    );

    server.registerTool(
      'check_automation',
      {
        title: 'Validate a draft without publishing it',
        description:
          'Runs exactly the rules publishing runs, without publishing. Returns publishable plus the list of errors, ' +
          'each pointing at the node that caused it. Fix and re-check until publishable is true, then hand the draft ' +
          'to the account owner.',
        inputSchema: { automationId: z.string() },
        annotations: READ_ONLY,
      },
      async ({ automationId }) => {
        const denied = this.lacksScope(principal, 'flows:read');
        if (denied) return denied;
        const result = await this.checkFlow.execute(principal.tenantId, automationId);
        if (!result.ok) return asProblem(`${result.error.code}: ${result.error.message}`);
        return asJson(result.value);
      },
    );

    server.registerTool(
      'simulate_automation',
      {
        title: 'Run the automation against a simulated customer',
        description:
          'Runs the real engine against a fake customer and returns what that customer would receive. Nothing leaves ' +
          'the system: no WhatsApp message is sent, no webhook fires, no HTTP call reaches your systems. Pass the ' +
          'session returned by the previous call to continue the same simulated conversation.',
        inputSchema: {
          automationId: z.string(),
          source: z.enum(['draft', 'published']).default('draft'),
          session: z.record(z.string(), z.unknown()).nullable().optional(),
          text: z.string().max(4096).optional(),
          optionId: z.string().max(200).optional(),
        },
        annotations: SAFE_WRITE,
      },
      async ({ automationId, source, session, text, optionId }) => {
        const denied = this.lacksScope(principal, 'flows:write');
        if (denied) return denied;
        const result = await this.simulateFlow.execute({
          tenantId: principal.tenantId,
          flowId: automationId,
          source,
          session: (session ?? null) as never,
          text,
          optionId,
        });
        if (!result.ok) return asProblem(`${result.error.code}: ${result.error.message}`);
        return asJson(result.value);
      },
    );
  }

  private registerAuthoringPrompts(server: McpServer): void {
    server.registerPrompt(
      'build_receptionist',
      {
        title: 'Build a WhatsApp receptionist',
        description:
          'Guides you through building the automation most businesses ask for first: answering the questions that ' +
          'repeat all day, and handing over to a person when it cannot.',
        argsSchema: {
          business: z.string().describe('What the business does, in plain words'),
          questions: z.string().describe('The questions customers repeat, separated by commas'),
        },
      },
      ({ business, questions }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Build a WhatsApp receptionist automation in asis.chat for this business: ${business}.\n` +
                `The questions customers repeat are: ${questions}.\n\n` +
                'Work in this order:\n' +
                '1. Read the asis://automations/node-types and asis://whatsapp/component-limits resources.\n' +
                '2. Call list_phone_numbers to know which line it should answer on.\n' +
                '3. Create the draft with create_automation, then build the graph with update_automation_graph. ' +
                'Offer the repeated questions as buttons or a list rather than asking for free text, and always leave ' +
                'a way out to a human.\n' +
                '4. Call check_automation and fix every error it reports until publishable is true.\n' +
                '5. Call simulate_automation and walk the main path plus one path where the customer types something ' +
                'unexpected.\n' +
                '6. Report what you built and tell the owner they have to publish it themselves from the app.',
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      'turn_conversation_into_automation',
      {
        title: 'Turn a real conversation into an automation',
        description:
          'Takes a conversation that already happened and reproduces it as an automation. Starting from a real chat ' +
          'beats starting from a blank canvas, because the wording and the branches are already proven.',
        argsSchema: {
          conversationId: z.string().describe('The conversation to reproduce'),
        },
      },
      ({ conversationId }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Read conversation ${conversationId} with list_conversation_messages and turn it into an asis.chat automation.\n\n` +
                'Rules:\n' +
                '- Keep the wording the business actually used. Do not make it sound like a corporate bot.\n' +
                '- Wherever the customer had to type something that has a small set of valid answers, use buttons or ' +
                'a list instead, respecting the limits in asis://whatsapp/component-limits.\n' +
                '- Cover what happens when the customer answers something you did not expect, and when they never answer.\n' +
                '- Build it with create_automation and update_automation_graph, then run check_automation until it is ' +
                'publishable and simulate_automation to walk it.\n' +
                '- Finish by listing what the conversation did that the automation could not reproduce, so the owner ' +
                'knows what is missing before publishing.',
            },
          },
        ],
      }),
    );
  }
}
