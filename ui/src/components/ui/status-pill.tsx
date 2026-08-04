import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Semántica de estado, no color: los dominios (campañas, plantillas,
 * destinatarios, agentes) mapean su estado a un `tone` y el color se decide
 * acá. Este archivo es el **único** lugar de la app fuera del chat donde se
 * permite paleta cruda de Tailwind — todo lo demás usa tokens.
 */
const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        scheduled: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
        primary: "bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

export type StatusTone = NonNullable<VariantProps<typeof statusPillVariants>["tone"]>

interface StatusPillProps extends VariantProps<typeof statusPillVariants> {
  /** Punto latiendo a la izquierda; para estados en curso (campaña enviando). */
  pulse?: boolean
  children: React.ReactNode
  className?: string
}

function StatusPill({ tone, pulse, children, className }: StatusPillProps) {
  return (
    <span data-slot="status-pill" className={cn(statusPillVariants({ tone }), className)}>
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  )
}

const DOT_TONES: Record<StatusTone, string> = {
  neutral: "bg-slate-400 dark:bg-slate-500",
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  scheduled: "bg-violet-500",
  primary: "bg-primary",
}

/** Punto de color suelto: disponibilidad de agentes, calidad de plantillas. */
function StatusDot({ tone = "neutral", className }: { tone?: StatusTone; className?: string }) {
  return <span data-slot="status-dot" className={cn("size-2 shrink-0 rounded-full", DOT_TONES[tone], className)} />
}

export { StatusPill, StatusDot, statusPillVariants }
