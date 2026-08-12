import type { FlowGraph } from '../../../../domain/entities/flow.entity.js';
import { isSessionSend, isTrigger } from './flow-node-types.js';

const MAX_EXPANSIONS = 50_000;

export interface BillableSendsResult {
  worst: number;
  path: string[];
  truncated: boolean;
}

export function isBillableSend(type: string): boolean {
  return isSessionSend(type) || type === 'action.send_template';
}

export function worstCaseBillableSends(graph: FlowGraph): BillableSendsResult {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    const targets = outgoing.get(edge.source);
    if (targets) targets.push(edge.target);
    else outgoing.set(edge.source, [edge.target]);
  }

  const starts = graph.nodes.filter((node) => isTrigger(node.type)).map((node) => node.id);
  if (starts.length === 0) {
    const targeted = new Set(graph.edges.map((edge) => edge.target));
    starts.push(...graph.nodes.filter((node) => !targeted.has(node.id)).map((node) => node.id));
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

    const node = nodes.get(nodeId);
    if (!node) return;

    const billable = isBillableSend(node.type);
    const total = count + (billable ? 1 : 0);

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
