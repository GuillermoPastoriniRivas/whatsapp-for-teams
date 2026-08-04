"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Botones de la derecha. Bajan a la línea siguiente si no entran. */
  actions?: React.ReactNode
  /** Muestra una flecha de volver a esta ruta. */
  backHref?: string
  /** Segunda fila: filtros, tabs o buscador. */
  children?: React.ReactNode
  className?: string
}

/**
 * Cabecera de pantalla. Antes cada página armaba la suya y no había dos
 * iguales: cinco tamaños de `h1` distintos y tres paddings.
 */
function PageHeader({ title, subtitle, actions, backHref, children, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("shrink-0 border-b px-4 py-3 md:px-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Button asChild variant="ghost" size="icon-sm" className="-ml-1 shrink-0">
              <Link href={backHref} aria-label="Volver">
                <ArrowLeftIcon />
              </Link>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && (
        <div className="scrollbar-hide -mb-1 mt-3 flex gap-1.5 overflow-x-auto pb-1">{children}</div>
      )}
    </header>
  )
}

export { PageHeader }
