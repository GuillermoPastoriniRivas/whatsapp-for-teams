"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

/** Lo mínimo que un control tiene que aceptar para que `Field` lo pueda etiquetar. */
interface FieldControlProps {
  id?: string
  "aria-invalid"?: boolean | "true" | "false"
  "aria-describedby"?: string
}

interface FieldProps {
  label: React.ReactNode
  /** Texto de ayuda bajo el control. Se oculta cuando hay error. */
  hint?: React.ReactNode
  error?: string
  required?: boolean
  /** Un único control: Input, Textarea, SimpleSelect, etc. */
  children: React.ReactElement<FieldControlProps>
  className?: string
}

/**
 * Campo de formulario: etiqueta, control, ayuda y error.
 *
 * Ata la etiqueta al control (`htmlFor`/`id`) y publica el error por
 * `aria-invalid` + `aria-describedby` sin que cada formulario tenga que
 * acordarse. Antes esto se armaba a mano en cada pantalla, casi siempre sin
 * `htmlFor`, así que el click en la etiqueta no enfocaba nada.
 */
function Field({ label, hint, error, required, children, className }: FieldProps) {
  const reactId = React.useId()
  const controlId = children.props.id ?? `field-${reactId}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  const describedBy =
    [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined

  const control = React.cloneElement(children, {
    id: controlId,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-describedby":
      [children.props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
  })

  return (
    <div data-slot="field" className={cn("space-y-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export { Field }
