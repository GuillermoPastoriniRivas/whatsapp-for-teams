"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

interface PaginationProps {
  page: number
  pages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Paginación de listados. Una sola variante para toda la app. */
function Pagination({ page, pages, onPageChange, className }: PaginationProps) {
  const { t } = useTranslations()
  if (pages <= 1) return null

  return (
    <nav
      data-slot="pagination"
      aria-label={t.common.pagination}
      className={cn("flex items-center justify-center gap-2 pt-4", className)}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
        {t.common.previous}
      </Button>
      <span className="px-1 text-sm text-muted-foreground tabular-nums">
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        {t.common.next}
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}

export { Pagination }
