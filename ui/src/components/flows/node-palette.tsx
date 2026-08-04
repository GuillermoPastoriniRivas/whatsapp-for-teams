"use client";

import { cn } from "@/lib/utils";
import { NODE_CATALOG, CATEGORY_LABELS, CATEGORY_STYLES, isTriggerType, type NodeCategory } from "@/lib/flows/node-catalog";

const CATEGORY_ORDER: NodeCategory[] = ["message", "ai", "team", "logic", "integration"];

/**
 * Paleta de nodos: drag & drop al canvas (o click para agregar al centro).
 * Los triggers no aparecen: cada flujo tiene exactamente uno, pre-colocado.
 */
export function NodePalette({ onAdd }: { onAdd: (nodeType: string) => void }) {
  return (
    // h-full + min-h-0: sin altura acotada el overflow-y nunca se activa y la
    // lista de nodos se desborda por debajo del viewport.
    <div className="w-56 shrink-0 border-r bg-background h-full min-h-0 overflow-y-auto p-3 space-y-4">
      {CATEGORY_ORDER.map((category) => (
        <div key={category}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            {CATEGORY_LABELS[category]}
          </p>
          <div className="space-y-1">
            {NODE_CATALOG.filter((def) => def.category === category && !isTriggerType(def.type)).map((def) => {
              const styles = CATEGORY_STYLES[def.category];
              const Icon = def.icon;
              return (
                <button
                  key={def.type}
                  className="w-full flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-flow-node", def.type);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAdd(def.type)}
                  title={def.description}
                >
                  <span className={cn("rounded p-1 shrink-0", styles.iconBg)}>
                    <Icon className={cn("size-3.5", styles.icon)} />
                  </span>
                  <span className="text-xs font-medium truncate">{def.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
