import type { FlowNode, FlowEdge } from "@/types";

const MAX_EXPANSIONS = 50_000;

const SESSION_SENDS = new Set([
  "action.send_text",
  "action.send_media",
  "action.send_location",
  "action.send_buttons",
  "action.send_list",
  "action.send_cta_url",
  "action.send_contact",
  "action.send_flow",
  "action.ask",
  "action.request_location",
  "action.react",
  "action.ai_reply",
  "action.send_template",
]);

export interface BillableSendsResult {
  worst: number;
  path: string[];
  truncated: boolean;
}

export function isBillableSend(type: string): boolean {
  return SESSION_SENDS.has(type);
}

export function worstCaseBillableSends(nodes: FlowNode[], edges: FlowEdge[]): BillableSendsResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const targets = outgoing.get(edge.source);
    if (targets) targets.push(edge.target);
    else outgoing.set(edge.source, [edge.target]);
  }

  const starts = nodes.filter((node) => node.type.startsWith("trigger.")).map((node) => node.id);
  if (starts.length === 0) {
    const targeted = new Set(edges.map((edge) => edge.target));
    starts.push(...nodes.filter((node) => !targeted.has(node.id)).map((node) => node.id));
  }

  let worst = 0;
  let worstPath: string[] = [];
  let expansions = 0;
  let truncated = false;

  const visited = new Set<string>();
  const path: string[] = [];

  const walk = (nodeId: string, count: number): void => {
    if (truncated) return;
    if (++expansions > MAX_EXPANSIONS) {
      truncated = true;
      return;
    }

    const node = byId.get(nodeId);
    if (!node) return;

    const total = count + (isBillableSend(node.type) ? 1 : 0);

    visited.add(nodeId);
    path.push(nodeId);

    if (total > worst) {
      worst = total;
      worstPath = [...path];
    }

    for (const next of outgoing.get(nodeId) ?? []) {
      if (!visited.has(next)) walk(next, total);
    }

    visited.delete(nodeId);
    path.pop();
  };

  for (const start of starts) walk(start, 0);

  return { worst, path: worstPath, truncated };
}
