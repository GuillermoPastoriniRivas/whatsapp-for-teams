"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ACTIVE_FLOW } from "./order-constants";
import type { OrderStatus } from "@/types";

const STEP_FILLED = [
  "bg-amber-500 text-white",
  "bg-blue-500 text-white",
  "bg-orange-500 text-white",
  "bg-green-500 text-white",
  "bg-indigo-500 text-white",
];

const STEP_RING = [
  "bg-amber-500 text-white ring-2 ring-amber-500/40",
  "bg-blue-500 text-white ring-2 ring-blue-500/40",
  "bg-orange-500 text-white ring-2 ring-orange-500/40",
  "bg-green-500 text-white ring-2 ring-green-500/40",
  "bg-indigo-500 text-white ring-2 ring-indigo-500/40",
];

const LINE_FILLED = [
  "bg-amber-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-500",
  "bg-indigo-500",
];

interface OrderStatusStepperProps {
  status: OrderStatus;
}

export function OrderStatusStepper({ status }: OrderStatusStepperProps) {
  const { t } = useTranslations();
  const currentIndex = ACTIVE_FLOW.indexOf(status);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center">
        {ACTIVE_FLOW.map((step, i) => {
          const label = t.orders[step as keyof typeof t.orders] ?? step;
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={step} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-0.5 w-3 ${
                    isCompleted || isCurrent
                      ? LINE_FILLED[i - 1]
                      : "bg-muted-foreground/20"
                  }`}
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? STEP_RING[i]
                        : isCompleted
                        ? STEP_FILLED[i]
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
