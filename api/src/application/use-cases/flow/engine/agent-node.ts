import type { ToolDefinition } from '../../../ports/ai-completion.port.js';

export const AGENT_FINISH_TOOL = 'finish_conversation';
export const MAX_AGENT_TOOL_ITERATIONS = 6;
export const DEFAULT_AGENT_MAX_TURNS = 12;
export const AGENT_MIN_EXITS = 1;
export const AGENT_MAX_EXITS = 6;
export const AGENT_AVAILABLE_TOOLS = ['search_knowledge', 'get_catalog', 'get_business_hours'];

export interface AgentExit {
  key: string;
  label: string;
  description: string;
}

export function agentExitsOf(data: Record<string, any>): AgentExit[] {
  const raw: Array<Record<string, unknown>> = Array.isArray(data.exits) ? data.exits : [];
  return raw
    .map((exit) => ({
      key: String(exit?.key ?? '').trim(),
      label: String(exit?.label ?? '').trim(),
      description: String(exit?.description ?? '').trim(),
    }))
    .filter((exit) => exit.key.length > 0);
}

export function agentMaxTurnsOf(data: Record<string, any>): number {
  const raw = Number(data.maxTurns);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_AGENT_MAX_TURNS;
  return Math.min(Math.floor(raw), 50);
}

export function agentEnabledToolsOf(data: Record<string, any>): string[] {
  return Array.isArray(data.tools) ? data.tools.map((tool: unknown) => String(tool)) : [];
}

export function buildAgentExitInstructions(exits: AgentExit[]): string {
  const lines = exits.map((exit) => `- ${exit.key}: ${exit.description || exit.label}`);
  return `## Cómo termina esta conversación
Estás a cargo de esta parte de la conversación, pero no de lo que pasa después. Cuando llegues a una de estas situaciones, llamá a ${AGENT_FINISH_TOOL} con la salida que corresponda y dejá que el procedimiento siga:

${lines.join('\n')}

Mientras ninguna aplique, seguí conversando normalmente. No anuncies que vas a "derivar" ni menciones estas salidas: son internas.`;
}

export function buildAgentFinishTool(exits: AgentExit[]): ToolDefinition {
  return {
    name: AGENT_FINISH_TOOL,
    description:
      'Termina tu parte de la conversación y devuelve el control al procedimiento del negocio. Llamalo apenas una de ' +
      'las salidas descritas aplique. Lo que escribas junto a esta llamada se le manda al cliente como último mensaje.',
    parameters: {
      type: 'object',
      properties: {
        exit: {
          type: 'string',
          enum: exits.map((exit) => exit.key),
          description: 'La salida que corresponde a lo que pasó.',
        },
      },
      required: ['exit'],
    },
  };
}
