"use client";
"use no memo";

// Nodo custom del canvas. Renderiza icono/categoría, resumen de config y un
// handle de salida etiquetado por rama. El React Compiler queda excluido:
// xyflow depende de identidades internas de callbacks.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { NODE_BY_TYPE, CATEGORY_STYLES, nodeHandles, nodeSummary, isTriggerType } from "@/lib/flows/node-catalog";
import type { FlowNode as FlowNodeData } from "@/types";

export interface CanvasNodeData {
  nodeType: string;
  config: Record<string, unknown>;
  hasError?: boolean;
  stat?: { entered: number; errors: number } | null;
  [key: string]: unknown;
}

const HANDLE_ROW_HEIGHT = 22;

export function FlowNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const def = NODE_BY_TYPE.get(nodeData.nodeType);
  const styles = CATEGORY_STYLES[def?.category ?? "logic"];
  const asFlowNode: FlowNodeData = { id, type: nodeData.nodeType, position: { x: 0, y: 0 }, data: nodeData.config };
  const handles = nodeHandles(asFlowNode);
  const summary = nodeSummary(asFlowNode);
  const Icon = def?.icon;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm border-l-4 min-w-52 max-w-64",
        styles.border,
        selected && "ring-2 ring-primary",
        nodeData.hasError && "ring-2 ring-destructive",
      )}
    >
      {!isTriggerType(nodeData.nodeType) && (
        <Handle type="target" position={Position.Left} className="!size-2.5 !bg-muted-foreground" />
      )}

      <div className="p-3 pb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={cn("rounded-md p-1.5 shrink-0", styles.iconBg)}>
              <Icon className={cn("size-3.5", styles.icon)} />
            </span>
          )}
          <span className="text-sm font-medium truncate">{def?.label ?? nodeData.nodeType}</span>
        </div>
        {summary && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{summary}</p>}
        {nodeData.stat && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {nodeData.stat.entered}× ejecutado
            {nodeData.stat.errors > 0 && <span className="text-destructive"> · {nodeData.stat.errors} errores</span>}
          </p>
        )}
      </div>

      {handles.length > 0 && (
        <div className="relative border-t border-border/60 py-1">
          {handles.map((handle) => (
            <div key={handle.id} className="relative flex items-center justify-end pr-3" style={{ height: HANDLE_ROW_HEIGHT }}>
              <span
                className={cn(
                  "text-[10px] truncate max-w-44",
                  handle.kind === "error" ? "text-destructive/70" : handle.kind === "alt" ? "text-muted-foreground" : "text-foreground/80",
                )}
              >
                {handle.label || "→"}
              </span>
              <Handle
                id={handle.id}
                type="source"
                position={Position.Right}
                className={cn(
                  "!size-2.5",
                  handle.kind === "error" ? "!bg-destructive" : handle.kind === "alt" ? "!bg-muted-foreground" : "!bg-primary",
                )}
                style={{ top: "50%", transform: "translate(50%, -50%)", position: "absolute", right: 0 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
