import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AsisMcpServerFactory } from './asis-mcp-server.factory.js';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import { ConversationWindowExpiredError } from '../../domain/errors/domain-errors.js';
import { WHATSAPP_COMPONENT_LIMITS } from '../../application/use-cases/flow/engine/whatsapp-component-limits.js';

const ALL_SCOPES: ApiKeyPrincipal = {
  tenantId: 't1',
  apiKeyId: 'k1',
  keyName: 'agent key',
  scopes: ['messages:read', 'messages:write', 'flows:read', 'flows:write'],
  createdByAgentId: 'a1',
};

const READ_ONLY_MESSAGING: ApiKeyPrincipal = { ...ALL_SCOPES, scopes: ['messages:read'] };

function buildFactory(overrides: Record<string, any> = {}): AsisMcpServerFactory {
  const emptyPage = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  const deps = {
    phoneRepo: { findByTenantId: jest.fn().mockResolvedValue([]) },
    conversationRepo: { findByFilters: jest.fn().mockResolvedValue(emptyPage), findById: jest.fn().mockResolvedValue(null) },
    messageRepo: { findByConversationId: jest.fn().mockResolvedValue(emptyPage) },
    contactRepo: { findByTenantId: jest.fn().mockResolvedValue(emptyPage), findById: jest.fn().mockResolvedValue(null) },
    templateRepo: { findByFilters: jest.fn().mockResolvedValue(emptyPage) },
    agentRepo: { findByTenantId: jest.fn().mockResolvedValue([]) },
    labelRepo: { findByTenantId: jest.fn().mockResolvedValue([]) },
    connectionRepo: { findByTenantId: jest.fn().mockResolvedValue([]) },
    sendApiMessage: { execute: jest.fn() },
    createContact: { execute: jest.fn() },
    createLabel: { execute: jest.fn() },
    updateLabel: { execute: jest.fn() },
    createFlow: { execute: jest.fn() },
    listFlows: { execute: jest.fn().mockResolvedValue([]) },
    getFlow: { execute: jest.fn() },
    updateFlow: { execute: jest.fn() },
    checkFlow: { execute: jest.fn() },
    simulateFlow: { execute: jest.fn() },
    ...overrides,
  };
  return new AsisMcpServerFactory(
    deps.phoneRepo as any,
    deps.conversationRepo as any,
    deps.messageRepo as any,
    deps.contactRepo as any,
    deps.templateRepo as any,
    deps.agentRepo as any,
    deps.labelRepo as any,
    deps.connectionRepo as any,
    deps.sendApiMessage as any,
    deps.createContact as any,
    deps.createLabel as any,
    deps.updateLabel as any,
    deps.createFlow as any,
    deps.listFlows as any,
    deps.getFlow as any,
    deps.updateFlow as any,
    deps.checkFlow as any,
    deps.simulateFlow as any,
  );
}

async function connect(factory: AsisMcpServerFactory, principal: ApiKeyPrincipal): Promise<Client> {
  const server = factory.create(principal);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'spec', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function textOf(result: any): string {
  return (result.content as Array<{ text: string }>).map((part) => part.text).join('\n');
}

describe('AsisMcpServerFactory', () => {
  it('marca como destructivas solo las herramientas que le hablan a un cliente real', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get('send_whatsapp_message')?.annotations?.destructiveHint).toBe(true);
    expect(byName.get('reply_in_conversation')?.annotations?.destructiveHint).toBe(true);

    expect(byName.get('list_conversations')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('check_automation')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('simulate_automation')?.annotations?.destructiveHint).toBe(false);
  });

  it('no expone publicar una automatización', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('create_automation');
    expect(names).toContain('check_automation');
    expect(names.some((name) => name.includes('publish'))).toBe(false);
  });

  it('explica qué permiso falta en vez de fallar sin más', async () => {
    const client = await connect(buildFactory(), READ_ONLY_MESSAGING);
    const result: any = await client.callTool({ name: 'list_automations', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('flows:read');
    expect(textOf(result)).toContain('Do not retry');
  });

  it('cuando la ventana de 24 h está cerrada, devuelve las plantillas aprobadas para reintentar', async () => {
    const factory = buildFactory({
      sendApiMessage: { execute: jest.fn().mockResolvedValue({ ok: false, error: new ConversationWindowExpiredError() }) },
      templateRepo: {
        findByFilters: jest.fn().mockResolvedValue({
          data: [{ id: 'tpl_1', name: 'recordatorio_turno', language: 'es', phoneNumberId: 'p1' }],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      },
    });
    const client = await connect(factory, ALL_SCOPES);
    const result: any = await client.callTool({
      name: 'send_whatsapp_message',
      arguments: { to: '+5491100000000', body: 'hola' },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('CONVERSATION_WINDOW_EXPIRED');
    expect(text).toContain('templateId');
    expect(text).toContain('recordatorio_turno');
  });

  it('avisa que no hay ninguna plantilla aprobada cuando la cuenta no tiene', async () => {
    const factory = buildFactory({
      sendApiMessage: { execute: jest.fn().mockResolvedValue({ ok: false, error: new ConversationWindowExpiredError() }) },
    });
    const client = await connect(factory, ALL_SCOPES);
    const result: any = await client.callTool({
      name: 'send_whatsapp_message',
      arguments: { to: '+5491100000000', body: 'hola' },
    });

    expect(textOf(result)).toContain('no approved template');
  });

  it('publica el catálogo de nodos y los límites del canal como recursos', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const { resources } = await client.listResources();
    const uris = resources.map((resource) => resource.uri);

    expect(uris).toContain('asis://automations/node-types');
    expect(uris).toContain('asis://whatsapp/component-limits');

    const limits = await client.readResource({ uri: 'asis://whatsapp/component-limits' });
    const payload = JSON.parse((limits.contents[0] as { text: string }).text);
    expect(payload.limits).toEqual(WHATSAPP_COMPONENT_LIMITS);

    const catalog = await client.readResource({ uri: 'asis://automations/node-types' });
    const nodeTypes = JSON.parse((catalog.contents[0] as { text: string }).text);
    const buttons = nodeTypes.nodeTypes.find((node: any) => node.type === 'action.send_buttons');
    expect(buttons.dynamicOutputs).toBe(true);
    expect(buttons.outputs).toContain('other');
  });

  it('el catálogo dice qué campos lleva cada nodo, que es lo que no se puede adivinar', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const catalog = await client.readResource({ uri: 'asis://automations/node-types' });
    const nodeTypes = JSON.parse((catalog.contents[0] as { text: string }).text);

    const sinCampos = nodeTypes.nodeTypes.filter((node: any) => node.fields.length === 0);
    expect(sinCampos.map((node: any) => node.type)).toEqual([]);

    const actualizarContacto = nodeTypes.nodeTypes.find((node: any) => node.type === 'action.update_contact');
    expect(actualizarContacto.fields[0]).toMatchObject({ name: 'fields', required: true });

    const lista = nodeTypes.nodeTypes.find((node: any) => node.type === 'action.send_list');
    expect(lista.fields.some((field: any) => field.name === 'saveAs')).toBe(true);
  });

  it('expone los bloques que el validador exige elegir de una lista', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('list_labels');
    expect(names).toContain('list_team_agents');
    expect(names).toContain('list_http_connections');
    expect(names).toContain('create_label');
    expect(names).toContain('update_label');
  });

  it('deja crear etiquetas con permiso de cualquiera de las dos mitades', async () => {
    const creada = { id: 'lab_1', name: 'Turno', color: 'teal' };

    for (const scopes of [['flows:write'], ['messages:write']] as ApiKeyPrincipal['scopes'][]) {
      const factory = buildFactory({ createLabel: { execute: jest.fn().mockResolvedValue({ ok: true, value: creada }) } });
      const client = await connect(factory, { ...ALL_SCOPES, scopes });
      const result: any = await client.callTool({
        name: 'create_label',
        arguments: { name: 'Turno', color: 'teal' },
      });
      expect(result.isError ?? false).toBe(false);
      expect(textOf(result)).toContain('lab_1');
    }
  });

  it('no deja crear etiquetas con una clave de solo lectura', async () => {
    const client = await connect(buildFactory(), READ_ONLY_MESSAGING);
    const result: any = await client.callTool({
      name: 'create_label',
      arguments: { name: 'Turno', color: 'teal' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('flows:write');
  });

  it('cuando el nombre ya existe, manda a mirar las que hay', async () => {
    const factory = buildFactory({
      createLabel: {
        execute: jest.fn().mockResolvedValue({
          ok: false,
          error: { code: 'DUPLICATE_LABEL_NAME', message: 'Ya existe una etiqueta con ese nombre.' },
        }),
      },
    });
    const client = await connect(factory, ALL_SCOPES);
    const result: any = await client.callTool({
      name: 'create_label',
      arguments: { name: 'Turno', color: 'teal' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('list_labels');
  });

  it('ofrece los prompts de autoría', async () => {
    const client = await connect(buildFactory(), ALL_SCOPES);
    const { prompts } = await client.listPrompts();
    const names = prompts.map((prompt) => prompt.name);

    expect(names).toContain('build_receptionist');
    expect(names).toContain('turn_conversation_into_automation');
  });
});
