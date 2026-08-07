/**
 * Le crea a cada número activo su automatización base: la que decide quién
 * atiende los chats nuevos cuando ninguna otra los agarra.
 *
 * Contexto: hasta ago-2026 el reparto de un chat nuevo lo hacía el webhook a
 * mano (auto-assign entre quienes tuvieran acceso al número). Ese camino murió;
 * ahora todo mensaje entrante lo rutea una automatización. Los números que
 * existían antes del cambio no tienen la suya, así que este script se las crea.
 *
 * ORDEN: deployar primero el código nuevo y después correr esto. Al revés no
 * rompe nada — el router tiene una red de seguridad que reparte al equipo si
 * ningún flujo agarró el chat — pero los tenants no ven su automatización base
 * hasta que corras el script.
 *
 * Es idempotente: si el número ya tiene la suya, no la toca.
 *
 * El responsable por defecto es el equipo, que es exactamente lo que hacía el
 * pipeline viejo. Excepción: si el número tiene un bot IA con acceso concedido
 * (se podía hacer por API), la base queda apuntando a ese bot para no cambiarle
 * el comportamiento al tenant.
 *
 *   npm run migrate:default-flows -- --dry-run   # muestra qué haría
 *   npm run migrate:default-flows                # aplica
 */
import 'dotenv/config';
import { connect, connection, model, Types } from 'mongoose';

import { FlowSchema } from './infrastructure/persistence/mongoose/schemas/flow.schema.js';
import { FlowVersionSchema } from './infrastructure/persistence/mongoose/schemas/flow-version.schema.js';
import { PhoneNumberSchema } from './infrastructure/persistence/mongoose/schemas/phone-number.schema.js';
import { AgentSchema } from './infrastructure/persistence/mongoose/schemas/agent.schema.js';
import { AgentPhoneAccessSchema } from './infrastructure/persistence/mongoose/schemas/agent-phone-access.schema.js';
import { AiAgentConfigSchema } from './infrastructure/persistence/mongoose/schemas/ai-agent-config.schema.js';
import { FlowStatus } from './domain/enums/flow-status.enum.js';
import { AgentType } from './domain/enums/agent-type.enum.js';
import { AgentRole } from './domain/enums/agent-role.enum.js';
import {
  DEFAULT_FLOW_DESCRIPTION,
  DEFAULT_FLOW_PRIORITY,
  DefaultResponder,
  buildDefaultPhoneFlowGraph,
  defaultFlowName,
} from './application/use-cases/flow/default-phone-flow.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI');

  await connect(uri);

  const Flow = model('FlowModel', FlowSchema);
  const FlowVersion = model('FlowVersionModel', FlowVersionSchema);
  const PhoneNumber = model('PhoneNumberModel', PhoneNumberSchema);
  const Agent = model('AgentModel', AgentSchema);
  const AgentPhoneAccess = model('AgentPhoneAccessModel', AgentPhoneAccessSchema);
  const AiAgentConfig = model('AiAgentConfigModel', AiAgentConfigSchema);

  const phones = await PhoneNumber.find({ status: 'active' }).lean();
  console.log(`${phones.length} números activos${dryRun ? ' (DRY RUN, no escribe)' : ''}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const phone of phones) {
    const phoneId = String(phone._id);
    const label = phone.label || phone.displayPhone;

    const existing = await Flow.findOne({ defaultForPhoneNumberId: new Types.ObjectId(phoneId) }).lean();
    if (existing) {
      console.log(`  = ${label} — ya tiene su automatización base`);
      skipped++;
      continue;
    }

    // Autor: un admin del tenant, o cualquier humano si no hay admin.
    const humans = await Agent.find({ tenantId: phone.tenantId, type: AgentType.HUMAN }).lean();
    const author = humans.find((a: any) => a.role === AgentRole.ADMIN) ?? humans[0];
    if (!author) {
      console.log(`  ! ${label} — el tenant no tiene ningún agente humano, se omite`);
      failed++;
      continue;
    }

    const responder = await resolveResponder(phone, { AgentPhoneAccess, Agent, AiAgentConfig });
    const graph = buildDefaultPhoneFlowGraph(phoneId, responder);
    const target =
      responder.kind === 'ai' ? `bot IA ${responder.aiAgentId}` : 'el equipo';
    console.log(`  + ${label} — responde ${target}`);

    if (dryRun) {
      created++;
      continue;
    }

    try {
      // Se crea ya publicada: un flujo base en borrador no rutea nada.
      const flow = await Flow.create({
        tenantId: phone.tenantId,
        name: defaultFlowName(label),
        description: DEFAULT_FLOW_DESCRIPTION,
        status: FlowStatus.PUBLISHED,
        draftGraph: graph,
        publishedVersionId: null,
        publishedVersion: 1,
        priority: DEFAULT_FLOW_PRIORITY,
        webhookToken: null,
        stats: { started: 0, completed: 0, failed: 0, cancelled: 0 },
        createdByAgentId: author._id,
        defaultForPhoneNumberId: new Types.ObjectId(phoneId),
      });

      const version = await FlowVersion.create({
        flowId: flow._id,
        tenantId: phone.tenantId,
        version: 1,
        graph,
        // Debe coincidir con buildTriggerIndex de PublishFlowUseCase.
        trigger: {
          type: 'inbound_message',
          phoneNumberIds: [phoneId],
          match: 'any',
          keywords: [],
          keywordMode: 'contains',
          onlyNewConversations: true,
          ignoreIfAssignedToHuman: true,
          contactPhoneField: null,
          contactNameField: null,
          campaignIds: [],
        },
        publishedByAgentId: author._id,
      });

      await Flow.updateOne({ _id: flow._id }, { $set: { publishedVersionId: version._id } });
      created++;
    } catch (error: any) {
      // El índice único de defaultForPhoneNumberId puede rebotar si el alta de
      // un número corrió en paralelo: eso es que ya está hecho, no un problema.
      console.log(`  ! ${label} — ${error?.message}`);
      failed++;
    }
  }

  console.log(`\n${created} creadas, ${skipped} ya estaban, ${failed} con problemas`);
  await connection.close();
}

/**
 * Preserva el comportamiento actual del número. Un bot IA con acceso concedido
 * competía en el reparto por carga, así que el número ya podía estar siendo
 * atendido por él; si es el único con acceso, era siempre él.
 */
async function resolveResponder(
  phone: any,
  models: { AgentPhoneAccess: any; Agent: any; AiAgentConfig: any },
): Promise<DefaultResponder> {
  const access = await models.AgentPhoneAccess.find({ phoneNumberId: phone._id }).lean();
  if (access.length === 0) return { kind: 'team' };

  const agents = await models.Agent.find({ _id: { $in: access.map((a: any) => a.agentId) } }).lean();
  const bots = agents.filter((a: any) => a.type === AgentType.AI);
  // Con humanos en el reparto no se puede saber a quién le tocaba: gana el
  // equipo, que es el comportamiento menos sorprendente.
  if (bots.length !== 1 || agents.length !== bots.length) return { kind: 'team' };

  const config = await models.AiAgentConfig.findOne({ agentId: bots[0]._id, isActive: true }).lean();
  if (!config) return { kind: 'team' };

  return { kind: 'ai', aiAgentId: String(bots[0]._id) };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
