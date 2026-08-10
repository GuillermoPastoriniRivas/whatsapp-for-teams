import { PublishFlowUseCase } from '../flow/publish-flow.use-case.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';

// El cupo de automatizaciones publicadas.
//
// Hay un solo cupo: `flows`. Usar IA no consume uno aparte — lo que limita el
// gasto del modelo es el tope diario de la cuenta (`Tenant.aiRateLimits`), no
// la cantidad de flujos.
//
// Lo que sí tiene que quedar afuera es la automatización base de cada número:
// la crea el alta de la línea, no la eligió nadie, y si consumiera cupo dar de
// alta un número podría dejar al tenant sin poder publicar lo suyo.

const AI_GRAPH = {
  nodes: [
    { id: 't', type: 'trigger.inbound_message', position: { x: 0, y: 0 }, data: { phoneScope: 'all', phoneNumberIds: [] } },
    { id: 'bot', type: 'action.handoff_ai', position: { x: 200, y: 0 }, data: { name: 'Asistente' } },
  ],
  edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'bot' }],
};

function build(opts: { flowsAllowed: boolean; isDefault?: boolean; status?: FlowStatus }) {
  const checked: string[] = [];
  const flow = {
    id: 'f1',
    tenantId: 't1',
    status: opts.status ?? FlowStatus.DRAFT,
    draftGraph: AI_GRAPH,
    webhookToken: null,
    defaultForPhoneNumberId: opts.isDefault ? 'linea-1' : null,
  };

  const useCase = new PublishFlowUseCase(
    { findById: async () => flow, update: async () => flow } as any,
    { findLatestByFlowId: async () => null, create: async () => ({ id: 'v1', version: 1 }) } as any,
    { findById: async () => null } as any,
    { findById: async () => null } as any,
    { findByTenantId: async () => [] } as any,
    { findByTenantId: async () => [] } as any,
    { findByTenantId: async () => [{ id: 'linea-1' }] } as any,
    {
      checkResource: async (_t: string, resource: string) => {
        checked.push(resource);
        return { current: 5, limit: 5, allowed: opts.flowsAllowed };
      },
    } as any,
  );

  return { useCase, checked };
}

describe('cupo de automatizaciones publicadas', () => {
  it('bloquea publicar si el plan se quedó sin cupo', async () => {
    const { useCase } = build({ flowsAllowed: false });
    const result = await useCase.execute('t1', 'f1', 'a1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('flows');
  });

  it('usar IA no consume un cupo aparte', async () => {
    const { useCase, checked } = build({ flowsAllowed: true });
    const result = await useCase.execute('t1', 'f1', 'a1');

    expect(result.ok).toBe(true);
    expect(checked).toEqual(['flows']);
  });

  it('la automatización base del número queda fuera del cupo', async () => {
    const { useCase, checked } = build({ flowsAllowed: false, isDefault: true });
    const result = await useCase.execute('t1', 'f1', 'a1');

    expect(result.ok).toBe(true);
    expect(checked).toEqual([]);
  });

  it('republicar una ya activa no choca contra su propio conteo', async () => {
    const { useCase, checked } = build({ flowsAllowed: false, status: FlowStatus.PUBLISHED });
    const result = await useCase.execute('t1', 'f1', 'a1');

    expect(result.ok).toBe(true);
    expect(checked).toEqual([]);
  });
});
