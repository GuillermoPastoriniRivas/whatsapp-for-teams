"use client"

import { Check, Minus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/lib/i18n/use-translations"
import { PLAN_ORDER, PLAN_SPECS, planComparison, planPrice } from "@/lib/plans"
import { cn } from "@/lib/utils"
import type { PlanTier } from "@/types"

import { PLAN_ICONS, usePlanNames, usePlanTaglines } from "./plan-card"

interface PlanComparisonProps {
  /** Plan contratado hoy: se tiñe la columna entera. */
  current?: PlanTier
  /** Marketing: "el más elegido". */
  highlighted?: PlanTier
  /** El CTA de cada columna lo decide la pantalla que la usa. */
  action?: (tier: PlanTier) => React.ReactNode
  /** Título de la tabla para lectores de pantalla. */
  caption?: string
  className?: string
}

/**
 * Los cuatro planes como tabla: una fila por característica, una columna por
 * plan. Cuatro tarjetas sueltas obligan a saltar de lista en lista para
 * responder "¿cuántos bots tiene Pro contra Business?"; acá la respuesta está
 * en una línea horizontal.
 *
 * Es la vista de escritorio. En pantalla chica no entran cinco columnas: ahí va
 * `PlanCard` apilada, como manda `DESIGN.md`.
 */
export function PlanComparison({
  current,
  highlighted,
  action,
  caption,
  className,
}: PlanComparisonProps) {
  const { t } = useTranslations()
  const planNames = usePlanNames()
  const taglines = usePlanTaglines()
  const { rows, common } = planComparison(t.billing)

  // Una sola columna acentuada: el plan contratado en facturación, el más
  // elegido en marketing. Teñir cada celda de punta a punta es lo que convierte
  // cuatro columnas en "esta es la mía y estas son las otras".
  const accented = current ?? highlighted
  const columnTint = (tier: PlanTier) =>
    tier === accented ? "bg-primary/5" : undefined

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-3xl border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption ?? t.billing.pricingTitle}</caption>

        <thead>
          <tr>
            <td className="w-52" />
            {PLAN_ORDER.map((tier) => {
              const Icon = PLAN_ICONS[tier]
              return (
                <th
                  key={tier}
                  scope="col"
                  className={cn(
                    "rounded-t-xl px-3 pt-4 pb-5 align-top font-normal",
                    columnTint(tier)
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          tier === accented ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-base font-semibold">{planNames[tier]}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight whitespace-nowrap tabular-nums">
                        {planPrice(tier, t.billing)}
                      </span>
                      {PLAN_SPECS[tier].priceMonthly > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t.billing.perMonth}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{taglines[tier]}</p>
                    {tier === highlighted && tier !== current && (
                      <Badge className="mt-1">{t.billing.mostPopular}</Badge>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th
                scope="row"
                className="border-t border-border py-2.5 pr-4 text-left font-normal text-muted-foreground"
              >
                {row.label}
              </th>
              {PLAN_ORDER.map((tier) => (
                <td
                  key={tier}
                  className={cn(
                    "border-t border-border px-3 py-2.5 text-center align-middle",
                    columnTint(tier)
                  )}
                >
                  <PlanValue value={row.values[tier]} />
                  {row.hints[tier] && (
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {row.hints[tier]}
                    </p>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {action && (
          <tfoot>
            <tr>
              <td className="border-t border-border" />
              {PLAN_ORDER.map((tier) => (
                <td
                  key={tier}
                  className={cn(
                    "rounded-b-xl border-t border-border px-3 pt-4 pb-4 align-top",
                    columnTint(tier)
                  )}
                >
                  {action(tier)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>

      {common.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t.billing.allPlansInclude}:{" "}
          {common
            .map((feature) =>
              typeof feature.value === "string"
                ? `${feature.label} (${feature.value})`
                : feature.label
            )
            .join(" · ")}
        </p>
      )}
    </div>
  )
}

function PlanValue({ value }: { value: string | boolean }) {
  const { t } = useTranslations()

  if (typeof value !== "boolean") {
    return <span className="font-medium tabular-nums">{value}</span>
  }
  return value ? (
    <Check className="mx-auto size-4 text-primary" aria-label={t.billing.included} />
  ) : (
    <Minus
      className="mx-auto size-4 text-muted-foreground/40"
      aria-label={t.billing.notIncluded}
    />
  )
}
