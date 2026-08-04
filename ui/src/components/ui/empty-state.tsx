import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** CTA opcional; se espera un `<Button>`. */
  action?: React.ReactNode
  className?: string
}

/**
 * Estado vacío de listas, grillas y paneles. Reemplaza las cuatro variantes que
 * convivían (icono suelto, card vacía, borde punteado, texto centrado).
 */
function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      {Icon && <Icon className="mb-3 size-10 text-muted-foreground/40" />}
      <p className="text-base font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
