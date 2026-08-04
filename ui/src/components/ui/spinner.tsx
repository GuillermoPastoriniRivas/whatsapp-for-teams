import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-4",
  default: "size-5",
  lg: "size-6",
} as const

interface SpinnerProps {
  size?: keyof typeof SIZES
  className?: string
}

function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Cargando"
      className={cn("animate-spin text-muted-foreground", SIZES[size], className)}
    />
  )
}

/** Bloque de carga centrado: el estado de espera de cualquier lista o panel. */
function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      data-slot="loading-state"
      className={cn("flex flex-col items-center justify-center gap-2 py-12", className)}
    >
      <Spinner />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

export { Spinner, LoadingState }
