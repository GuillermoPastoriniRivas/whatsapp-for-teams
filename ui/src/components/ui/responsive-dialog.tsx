"use client"

import * as React from "react"
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
} as const

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Obligatorio: lo anuncian los lectores de pantalla. `hideHeader` solo lo oculta a la vista. */
  title: string
  description?: string
  size?: keyof typeof SIZES
  hideHeader?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Contenido a pantalla completa sin marco (lightbox). */
  bare?: boolean
}

/**
 * Diálogo mobile-first: hoja inferior en teléfono, modal centrado desde `sm`.
 *
 * Sobre Radix Dialog, así que trae portal (indispensable: el `zoom` de
 * `.content-zoom` rompe `position: fixed` en el árbol de la página), foco
 * atrapado, retorno de foco al cerrar, Escape y bloqueo de scroll — todo lo que
 * los overlays hechos a mano no tenían.
 */
function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  hideHeader,
  footer,
  children,
  className,
  bare,
}: ResponsiveDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-(--z-overlay) bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            bare && "bg-black/85"
          )}
        />
        <DialogPrimitive.Content
          data-slot="responsive-dialog"
          className={cn(
            "fixed z-(--z-overlay) flex flex-col bg-background text-foreground shadow-lg outline-none",
            // Mobile: hoja inferior anclada, respetando el notch.
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
            "data-open:animate-in data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:slide-out-to-bottom-10",
            // Desktop: modal centrado.
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:pb-0",
            "sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
            SIZES[size],
            className
          )}
        >
          {hideHeader ? (
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description>{description}</DialogPrimitive.Description>}
            </VisuallyHidden.Root>
          ) : (
            <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" className="-mr-1 shrink-0">
                  <XIcon />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </DialogPrimitive.Close>
            </div>
          )}

          <div className={cn("min-h-0 flex-1 overflow-y-auto", !bare && "p-4")}>{children}</div>

          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { ResponsiveDialog }
