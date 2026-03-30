"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function RightPanel({ open, onClose, children, className }: RightPanelProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        // Mobile: full-screen overlay
        "absolute inset-0 z-40 flex flex-col bg-background h-full",
        // Desktop: inline panel on the right
        "md:relative md:inset-auto md:z-auto md:w-[340px] lg:md:w-[380px] md:shrink-0 md:border-l",
        className
      )}
    >
      {/* Mobile: back button */}
      <div className="flex items-center h-[52px] px-3 border-b md:hidden">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
      </div>

      {/* Desktop: chevron on the border */}
      <button
        onClick={onClose}
        className="absolute -left-2 top-2 z-50 hidden md:flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
