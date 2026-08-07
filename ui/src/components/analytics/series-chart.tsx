"use client";

import { useRef, useState } from "react";

/** Coordenadas del viewBox. El SVG escala; los trazos no (`non-scaling-stroke`). */
const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

export interface SeriesPoint {
  label: string;
  values: number[];
}

interface Props {
  points: SeriesPoint[];
  /** Nombre de cada serie, en el mismo orden que `values`. */
  seriesNames: string[];
  /** Token de color por serie, en orden fijo: una serie no cambia de color. */
  seriesColors: string[];
  formatValue?: (value: number) => string;
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * Gráfico de líneas con crosshair. Un gráfico en HTML **es** interactivo: sin
 * la capa de hover el usuario no puede leer un valor puntual, sólo la forma.
 *
 * Una sola escala en Y a propósito: dos ejes con escalas distintas hacen que
 * dos series se crucen donde no se cruzan.
 */
export function SeriesChart({ points, seriesNames, seriesColors, formatValue }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return null;

  const max = niceCeil(Math.max(1, ...points.flatMap((p) => p.values)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (index: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;

  const format = formatValue ?? ((value: number) => value.toLocaleString());

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    // El SVG se escala con el contenedor: hay que llevar el puntero al viewBox.
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (localX - PAD.left) / plotW;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  };

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={seriesNames.join(" · ")}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grilla recesiva: orienta sin competir con los datos. */}
        {gridLines.map((ratio) => (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * ratio)}
              y2={y(max * ratio)}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 6}
              y={y(max * ratio) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {format(Math.round(max * ratio))}
            </text>
          </g>
        ))}

        {points.map((point, index) =>
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text
              key={point.label}
              x={x(index)}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {point.label}
            </text>
          ) : null
        )}

        {seriesNames.map((_, series) => (
          <polyline
            key={series}
            fill="none"
            stroke={seriesColors[series]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            points={points.map((point, index) => `${x(index)},${y(point.values[series] ?? 0)}`).join(" ")}
          />
        ))}

        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {seriesNames.map((_, series) => (
              <circle
                key={series}
                cx={x(hover)}
                cy={y(points[hover].values[series] ?? 0)}
                r={5}
                fill={seriesColors[series]}
                // Anillo de superficie: separa el punto de la línea que cruza.
                className="stroke-card"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </>
        )}
      </svg>

      {/* Leyenda: con dos o más series la identidad nunca puede ser sólo color. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {seriesNames.map((name, series) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: seriesColors[series] }}
              aria-hidden
            />
            {name}
            {hover !== null && (
              <span className="font-medium tabular-nums text-foreground">
                {format(points[hover].values[series] ?? 0)}
              </span>
            )}
          </span>
        ))}
        {hover !== null && <span className="text-xs text-muted-foreground">· {points[hover].label}</span>}
      </div>
    </div>
  );
}
