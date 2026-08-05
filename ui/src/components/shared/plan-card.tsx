"use client"

import {
  Building2,
  Check,
  Crown,
  MessageSquare,
  Minus,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/lib/i18n/use-translations"
import { PLAN_SPECS, planFeatures, planPrice, type PlanFeature } from "@/lib/plans"
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

/** Bajada corta de cada plan: a quién está dirigido. */
export function usePlanTaglines(): Record<PlanTier, string> {
  const { t } = useTranslations()
  return {
    free: t.billing.freeTagline,
    pro: t.billing.proTagline,
    business: t.billing.businessTagline,
    agencies: t.billing.agenciesTagline,
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
 *
 * Las filas con valor (límites) van arriba en dos columnas; las de sí/no van
 * abajo como checklist. Mezcladas se leían como una tabla rota.
 */
export function PlanCard({ tier, current, highlighted, action, className }: PlanCardProps) {
  const { t } = useTranslations()
  const planNames = usePlanNames()
  const taglines = usePlanTaglines()
  const Icon = PLAN_ICONS[tier]
  const accented = current || highlighted

  const features = planFeatures(tier, t.billing)
  const limits = features.filter((f) => typeof f.value !== "boolean")
  const extras = features.filter((f) => typeof f.value === "boolean")

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
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {t.billing.mostPopular}
        </Badge>
      )}

      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            accented ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </div>
        <h3 className="min-w-0 truncate text-base font-semibold">{planNames[tier]}</h3>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          {planPrice(tier, t.billing)}
        </span>
        {PLAN_SPECS[tier].priceMonthly > 0 && (
          <span className="text-sm text-muted-foreground">{t.billing.perMonth}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{taglines[tier]}</p>

      <div className="my-4 border-t" />

      <div className="flex-1">
        <ul className="space-y-2.5 text-sm">
          {limits.map((feature) => (
            <li key={feature.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-muted-foreground">{feature.label}</span>
                <span className="shrink-0 text-right font-medium tabular-nums">
                  {feature.value}
                </span>
              </div>
              <FeatureHint feature={feature} />
            </li>
          ))}
        </ul>

        {extras.length > 0 && (
          <ul className="mt-4 space-y-2.5 border-t pt-4 text-sm">
            {extras.map((feature) => (
              <li key={feature.label}>
                <div className="flex items-center gap-2.5">
                  {feature.value ? (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-label={t.billing.included}
                    />
                  ) : (
                    <Minus
                      className="size-4 shrink-0 text-muted-foreground/40"
                      aria-label={t.billing.notIncluded}
                    />
                  )}
                  <span
                    className={cn("min-w-0", !feature.value && "text-muted-foreground")}
                  >
                    {feature.label}
                  </span>
                </div>
                <FeatureHint feature={feature} className="pl-6.5" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

function FeatureHint({ feature, className }: { feature: PlanFeature; className?: string }) {
  if (!feature.hint) return null
  return (
    <p className={cn("mt-0.5 text-xs leading-snug text-muted-foreground", className)}>
      {feature.hint}
    </p>
  )
}
