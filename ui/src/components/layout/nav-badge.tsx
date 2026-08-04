import { cn } from "@/lib/utils"

/** Contador de no leídos. Mismo tamaño en el sidebar y en la barra inferior. */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground tabular-nums",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}
