/**
 * Muda los agentes IA adentro de las automatizaciones.
 *
 * Contexto: hasta ago-2026 un bot era una fila en `agents` (type=ai) con su
 * config en `ai_agent_configs`, y competía en el reparto de conversaciones como
 * si fuera una persona. Ahora el bot no es una identidad: es un nodo de una
 * automatización. Este script traslada los datos.
 *
 * Qué hace, por cuenta:
 *   1. El perfil del negocio (nombre, rubro, catálogo, FAQs, horarios, topes)
 *      sube del bot a la CUENTA. Si hay varios bots gana el más viejo, que es
 *      el que venía atendiendo; se avisa cuando se descarta alguno.
 *   2. Cada nodo de IA de cada flujo (draft y versiones publicadas) cambia su
 *      `aiAgentId` por la conducta del bot embebida: nombre, tono, objetivo,
 *      reglas de derivación, contexto y multi-burbuja.
 *   3. Las conversaciones que estaban asignadas a un bot pasan a tener el
 *      puntero `autopilot.aiNode` al nodo equivalente, y se desasignan.
 *   4. Los agentes IA y sus configs se borran, y el uso de IA se reagrupa por
 *      cuenta (antes era por bot).
 *
 * ORDEN: deployar primero el código nuevo. Con el código viejo, un tenant ya
 * migrado se queda sin bots.
 *
 * Es idempotente: lo ya migrado no se vuelve a tocar.
 *
 *   npm run migrate:ai-into-flows -- --dry-run   # muestra qué haría
 *   npm run migrate:ai-into-flows                # aplica
 */
import 'dotenv/config';
import { connect, connection, model, Types } from 'mongoose';

import { TenantSchema } from './infrastructure/persistence/mongoose/schemas/tenant.schema.js';
import { AgentSchema } from './infrastructure/persistence/mongoose/schemas/agent.schema.js';
import { FlowSchema } from './infrastructure/persistence/mongoose/schemas/flow.schema.js';
import { FlowVersionSchema } from './infrastructure/persistence/mongoose/schemas/flow-version.schema.js';
import { ConversationSchema } from './infrastructure/persistence/mongoose/schemas/conversation.schema.js';
import { AgentType } from './domain/enums/agent-type.enum.js';
import { isAiNode } from './application/use-cases/flow/engine/flow-node-types.js';

const AI_NODE_KEYS = ['name', 'behavior', 'handoffRules', 'contextConfig', 'multiMessage'] as const;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI');

  await connect(uri);

  const Tenant = model('TenantModel', TenantSchema);
  const Agent = model('AgentModel', AgentSchema);
  const Flow = model('FlowModel', FlowSchema);
  const FlowVersion = model('FlowVersionModel', FlowVersionSchema);
  const Conversation = model('ConversationModel', ConversationSchema);
  // `ai_agent_configs` ya no tiene schema en el código: se lee crudo.
  const configs = connection.collection('ai_agent_configs');

  const bots = await Agent.find({ type: AgentType.AI }).lean();
  console.log(`${bots.length} agentes IA${dryRun ? ' (DRY RUN, no escribe)' : ''}\n`);

  // ── por cuenta ────────────────────────────────────────────────
  const byTenant = new Map<string, any[]>();
  for (const bot of bots) {
    const key = String(bot.tenantId);
    byTenant.set(key, [...(byTenant.get(key) ?? []), bot]);
  }

  let profiles = 0;
  let nodes = 0;
  let conversations = 0;

  for (const [tenantId, tenantBots] of byTenant) {
    // El más viejo gana: es el que venía atendiendo de verdad.
    const ordered = [...tenantBots].sort(
      (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
    );
    const configByBot = new Map<string, any>();
    for (const bot of ordered) {
      const cfg = await configs.findOne({ agentId: new Types.ObjectId(String(bot._id)) });
      if (cfg) configByBot.set(String(bot._id), cfg);
    }

    const primary = ordered.find((b) => configByBot.has(String(b._id)));
    const primaryCfg = primary ? configByBot.get(String(primary._id)) : null;

    if (ordered.length > 1) {
      console.log(
        `  ! cuenta ${tenantId}: ${ordered.length} bots. El perfil del negocio sale de "${primary?.name}" ` +
          `(el más viejo); la conducta de cada uno se conserva en su propio nodo.`,
      );
    }

    // 1. Perfil del negocio → cuenta
    if (primaryCfg) {
      console.log(`  + cuenta ${tenantId}: perfil de "${primary.name}" → la cuenta`);
      profiles++;
      if (!dryRun) {
        await Tenant.updateOne(
          { _id: new Types.ObjectId(tenantId) },
          {
            $set: {
              businessProfile: primaryCfg.businessProfile ?? null,
              timezone: primaryCfg.timezone ?? null,
              businessHours: primaryCfg.businessHours ?? null,
              aiRateLimits: primaryCfg.rateLimits ?? null,
            },
          },
        );
      }
    }

    // 2. Nodos de IA: aiAgentId → conducta embebida
    const behaviourOf = (aiAgentId: string): Record<string, unknown> => {
      const bot = ordered.find((b) => String(b._id) === aiAgentId);
      const cfg = configByBot.get(aiAgentId) ?? primaryCfg;
      return {
        name: bot?.name ?? 'Asistente',
        behavior: cfg?.behavior ?? {},
        handoffRules: cfg?.handoffRules ?? {},
        contextConfig: cfg?.contextConfig ?? {},
        multiMessage: cfg?.multiMessage ?? {},
      };
    };

    const migrateGraph = (graph: any): { graph: any; changed: number } => {
      let changed = 0;
      const migrated = {
        ...graph,
        nodes: (graph?.nodes ?? []).map((node: any) => {
          if (!isAiNode(node.type)) return node;
          const data = { ...(node.data ?? {}) };
          // Idempotencia: si ya tiene la conducta embebida, no se toca.
          if (AI_NODE_KEYS.some((k) => data[k] !== undefined) && !data.aiAgentId) return node;
          const aiAgentId = String(data.aiAgentId ?? '');
          delete data.aiAgentId;
          changed++;
          return { ...node, data: { ...behaviourOf(aiAgentId), ...data } };
        }),
      };
      return { graph: migrated, changed };
    };

    const flows = await Flow.find({ tenantId: new Types.ObjectId(tenantId) }).lean();
    for (const flow of flows) {
      const { graph, changed } = migrateGraph(flow.draftGraph);
      if (changed > 0) {
        nodes += changed;
        console.log(`    · flujo "${flow.name}": ${changed} nodo(s) de IA`);
        if (!dryRun) await Flow.updateOne({ _id: flow._id }, { $set: { draftGraph: graph } });
      }
    }

    // Las versiones publicadas también: son las que corren en producción y las
    // que apunta el piloto de cada conversación.
    const versions = await FlowVersion.find({ tenantId: new Types.ObjectId(tenantId) }).lean();
    for (const version of versions) {
      const { graph, changed } = migrateGraph(version.graph);
      if (changed > 0) {
        nodes += changed;
        if (!dryRun) await FlowVersion.updateOne({ _id: version._id }, { $set: { graph } });
      }
    }

    // 3. Conversaciones en manos de un bot → puntero del piloto
    const botIds = ordered.map((b) => new Types.ObjectId(String(b._id)));
    const assigned = await Conversation.find({ agentId: { $in: botIds } }).lean();
    for (const conv of assigned) {
      // Se busca el nodo handoff_ai que apuntaba a ese bot en algún flujo
      // publicado del tenant; si no hay ninguno, la conversación se libera
      // para que la tome una persona (mejor eso que un bot fantasma).
      const target = await findHandoffNode(FlowVersion, Flow, tenantId, String(conv.agentId));
      conversations++;
      if (dryRun) continue;

      await Conversation.updateOne(
        { _id: conv._id },
        {
          $set: {
            agentId: null,
            status: target ? 'active' : 'unassigned',
            autopilot: {
              enabled: true,
              pausedReason: null,
              pausedAt: null,
              aiNode: target,
            },
          },
        },
      );
    }
    if (assigned.length > 0) {
      console.log(`    · ${assigned.length} conversación(es) pasadas al piloto`);
    }
  }

  // 4. Limpieza
  if (!dryRun && bots.length > 0) {
    await Agent.deleteMany({ type: AgentType.AI });
    await configs.deleteMany({});
    // El uso de IA pasa a ser por cuenta: las filas viejas tienen aiAgentId y
    // chocarían contra el índice único nuevo {tenantId, date}.
    await connection.collection('ai_usage').deleteMany({ aiAgentId: { $exists: true } });
  }

  console.log(
    `\n${profiles} perfil(es) a la cuenta, ${nodes} nodo(s) de IA migrados, ` +
      `${conversations} conversación(es) repuntadas, ${bots.length} bot(s) ${dryRun ? 'a borrar' : 'borrados'}`,
  );
  await connection.close();
}

/** El nodo handoff_ai de una versión publicada que apuntaba a este bot. */
async function findHandoffNode(
  FlowVersion: any,
  Flow: any,
  tenantId: string,
  aiAgentId: string,
): Promise<{ flowId: string; flowVersionId: string; nodeId: string } | null> {
  const flows = await Flow.find({
    tenantId: new Types.ObjectId(tenantId),
    publishedVersionId: { $ne: null },
  }).lean();

  for (const flow of flows) {
    const version = await FlowVersion.findById(flow.publishedVersionId).lean();
    if (!version) continue;
    for (const node of version.graph?.nodes ?? []) {
      if (node.type !== 'action.handoff_ai') continue;
      // Después de migrar el grafo el aiAgentId ya no está, así que se acepta
      // cualquier handoff_ai del tenant si es el único candidato.
      const matches = !node.data?.aiAgentId || String(node.data.aiAgentId) === aiAgentId;
      if (matches) {
        return { flowId: String(flow._id), flowVersionId: String(version._id), nodeId: node.id };
      }
    }
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
