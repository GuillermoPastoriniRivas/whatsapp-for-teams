"use client";
"use no memo";

// Unión entre dos nodos. Trae su propio botón para quitarla: seleccionar la
// línea y apretar Delete funciona, pero nadie lo adivina.

import { createContext, useContext, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const HIT_AREA_WIDTH = 20;

/**
 * El borrado no sale de `deleteElements`: con el canvas controlado por el
 * padre, el estado que manda es el suyo. La arista pide que la quiten y el
 * canvas lo traduce al cambio que ya sabe aplicar.
 */
export const EdgeActions = createContext<{ remove: (edgeId: string) => void; editable: boolean }>({
  remove: () => {},
  editable: false,
});

export function FlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const { remove, editable } = useContext(EdgeActions);
  const [overLine, setOverLine] = useState(false);
  const [overButton, setOverButton] = useState(false);

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Dos estados y no uno: al pasar de la línea al botón, el mouseleave de la
  // línea llega después del mouseenter del botón, y con una sola bandera el
  // botón desaparecería justo cuando lo vas a tocar.
  const visible = editable && (selected || overLine || overButton);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "var(--primary)" : style?.stroke,
          strokeWidth: selected ? 2 : style?.strokeWidth,
        }}
      />

      <path
        d={path}
        fill="none"
        strokeWidth={HIT_AREA_WIDTH}
        stroke="transparent"
        className={editable ? "cursor-pointer" : undefined}
        onMouseEnter={() => setOverLine(true)}
        onMouseLeave={() => setOverLine(false)}
      />

      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "nodrag nopan absolute transition-opacity",
            visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onMouseEnter={() => setOverButton(true)}
          onMouseLeave={() => setOverButton(false)}
        >
          <button
            type="button"
            aria-label="Quitar esta unión"
            title="Quitar esta unión"
            onClick={() => remove(id)}
            className="flex size-5 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border transition-colors hover:bg-destructive hover:text-destructive-foreground hover:ring-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
