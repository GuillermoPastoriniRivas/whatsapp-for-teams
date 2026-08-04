"use client"

import { create } from "zustand"

import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { useTranslations } from "@/lib/i18n/use-translations"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Pinta el botón de confirmar como destructivo. */
  destructive?: boolean
}

interface ConfirmState {
  options: ConfirmOptions | null
  resolve: ((confirmed: boolean) => void) | null
  open: (options: ConfirmOptions) => Promise<boolean>
  close: (confirmed: boolean) => void
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      // Si ya había uno abierto, se lo da por cancelado antes de reemplazarlo.
      get().resolve?.(false)
      set({ options, resolve })
    }),
  close: (confirmed) => {
    get().resolve?.(confirmed)
    set({ options: null, resolve: null })
  },
}))

/**
 * Confirmación con la estética de la app en vez de `window.confirm`.
 *
 *   if (!(await confirm({ title: "¿Borrar campaña?", destructive: true }))) return
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore((s) => s.open)
}

/** Se monta una sola vez por layout. */
export function ConfirmDialogHost() {
  const { t } = useTranslations()
  const options = useConfirmStore((s) => s.options)
  const close = useConfirmStore((s) => s.close)

  return (
    <ResponsiveDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) close(false)
      }}
      title={options?.title ?? ""}
      description={options?.description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            {options?.cancelLabel ?? t.common.cancel}
          </Button>
          <Button
            variant={options?.destructive ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {options?.confirmLabel ?? t.common.confirm}
          </Button>
        </>
      }
    >
      {/* El texto vive en la descripción del encabezado; el cuerpo solo da aire. */}
      <span className="sr-only">{options?.description}</span>
    </ResponsiveDialog>
  )
}
