"use client"

import { cn } from "@/lib/utils"

interface FilterPillProps {
  active: boolean
  onClick: () => void
  /** Contador opcional a la derecha de la etiqueta. */
  count?: number
  children: React.ReactNode
  className?: string
}

/**
 * Pill de filtro de las barras de listado. Estilo outline con tinte: se apoya
 * solo en tokens (funciona en dark sin ramas) y no compite visualmente con las
 * `StatusPill` de colores que viven dentro de las filas.
 */
function FilterPill({ active, onClick, count, children, className }: FilterPillProps) {
  return (
    <button
      type="button"
      data-slot="filter-pill"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:h-7",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {children}
      {count !== undefined && <span className="text-xs font-normal opacity-60">{count}</span>}
    </button>
  )
}

export { FilterPill }
