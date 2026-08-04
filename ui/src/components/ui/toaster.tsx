"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useToastStore, type ToastItem } from "@/lib/toast"

const noop = () => () => {}

/** `true` solo en cliente; mismo patrón que `overlay.tsx` para no romper la hidratación. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
}

const VARIANTS = {
  success: { icon: CheckCircle2Icon, className: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: AlertCircleIcon, className: "text-destructive" },
  info: { icon: InfoIcon, className: "text-muted-foreground" },
} as const

function Toast({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const { icon: Icon, className } = VARIANTS[toast.variant]

  useEffect(() => {
    if (toast.duration <= 0) return
    const id = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(id)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg duration-200 animate-in fade-in slide-in-from-top-2"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.message}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Cerrar"
        className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

/**
 * Pila de avisos de `lib/toast`. Portalea a `body` porque el `zoom` de
 * `.content-zoom` rompe `position: fixed` dentro del árbol de la página.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const isClient = useIsClient()

  if (!isClient || toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-(--z-toast) flex flex-col gap-2 md:inset-x-auto md:right-4 md:w-96">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  )
}
