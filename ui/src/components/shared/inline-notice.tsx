"use client"

import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const VARIANTS = {
  success: {
    icon: CheckCircle2Icon,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircleIcon,
    className: "bg-destructive/10 text-destructive",
  },
  info: {
    icon: InfoIcon,
    className: "bg-muted text-muted-foreground",
  },
} as const

interface InlineNoticeProps {
  variant?: keyof typeof VARIANTS
  children: React.ReactNode
  className?: string
}

export function InlineNotice({ variant = "info", children, className }: InlineNoticeProps) {
  const { icon: Icon, className: variantClass } = VARIANTS[variant]
  return (
    <div className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-sm", variantClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
