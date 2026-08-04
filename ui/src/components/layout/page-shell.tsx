import { cn } from "@/lib/utils"

const WIDTHS = {
  full: null,
  /** Formularios y ajustes: una columna cómoda de leer. */
  narrow: "mx-auto w-full max-w-2xl",
  /** Tableros y tablas anchas. */
  wide: "mx-auto w-full max-w-5xl",
} as const

/**
 * Raíz de una pantalla del área logueada: cabecera fija arriba, contenido que
 * scrollea abajo. Va siempre junto a `PageHeader` + `PageContent`.
 */
function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-slot="page-shell" className={cn("flex h-full min-h-0 flex-col", className)}>
      {children}
    </div>
  )
}

function PageContent({
  children,
  width = "full",
  className,
}: {
  children: React.ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}) {
  const inner = WIDTHS[width]
  return (
    <div
      data-slot="page-content"
      // `pb-20` en mobile deja pasar la bottom-nav; en desktop no hace falta.
      className={cn("flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6", className)}
    >
      {inner ? <div className={inner}>{children}</div> : children}
    </div>
  )
}

export { PageShell, PageContent }
