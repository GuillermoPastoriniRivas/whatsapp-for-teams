"use client"

import {
  Building2,
  Check,
  Crown,
  MessageSquare,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/lib/i18n/use-translations"
import { PLAN_SPECS, planFeatures, planPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"
import type { PlanTier } from "@/types"

/** Un ícono por plan. Lo comparten la tarjeta y el resumen de facturación. */
export const PLAN_ICONS: Record<PlanTier, LucideIcon> = {
  free: MessageSquare,
  pro: Zap,
  business: Crown,
  agencies: Building2,
}

/** Nombre comercial de cada plan, ya traducido. */
export function usePlanNames(): Record<PlanTier, string> {
  const { t } = useTranslations()
  return {
    free: t.billing.freePlan,
    pro: t.billing.proPlan,
    business: t.billing.businessPlan,
    agencies: t.billing.agenciesPlan,
  }
}

interface PlanCardProps {
  tier: PlanTier
  /** Facturación: es el plan contratado hoy. */
  current?: boolean
  /** Marketing: "el más elegido". */
  highlighted?: boolean
  /** El CTA lo decide cada pantalla: botón, badge o nada. */
  action?: React.ReactNode
  className?: string
}

/**
 * Tarjeta de plan. Nombre, precio y detalle salen siempre de `lib/plans`, así
 * que landing, precios y facturación no pueden desincronizarse: antes el mismo
 * bloque estaba copiado en las tres pantallas, con tres estilos distintos.
 */
export function PlanCard({ tier, current, highlighted, action, className }: PlanCardProps) {
  const { t } = useTranslations()
  const planNames = usePlanNames()
  const Icon = PLAN_ICONS[tier]
  const accented = current || highlighted

  return (
    <div
      data-slot="plan-card"
      data-tier={tier}
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-5 transition-colors",
        current
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : highlighted
            ? "border-primary ring-2 ring-primary/20"
            : "border-border hover:border-primary/30",
        className
      )}
    >
      {highlighted && !current && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          {t.billing.mostPopular}
        </Badge>
      )}

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accented ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" />
        </div>
        <h3 className="min-w-0 text-base font-semibold">{planNames[tier]}</h3>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{planPrice(tier, t.billing)}</span>
        {PLAN_SPECS[tier].priceMonthly > 0 && (
          <span className="text-sm text-muted-foreground">{t.billing.perMonth}</span>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
        {t.billing.whatsIncluded}
      </p>
      <ul className="mt-2 flex-1 space-y-2 text-sm">
        {planFeatures(tier, t.billing).map((feature) => (
          <li key={feature.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-muted-foreground">{feature.label}</span>
              {typeof feature.value === "boolean" ? (
                feature.value ? (
                  <Check
                    className="size-4 shrink-0 self-center text-primary"
                    aria-label={t.billing.included}
                  />
                ) : (
                  <X
                    className="size-4 shrink-0 self-center text-muted-foreground/40"
                    aria-label={t.billing.notIncluded}
                  />
                )
              ) : (
                <span className="text-right font-medium">{feature.value}</span>
              )}
            </div>
            {feature.hint && (
              <p className="text-xs leading-tight text-muted-foreground">{feature.hint}</p>
            )}
          </li>
        ))}
      </ul>

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
