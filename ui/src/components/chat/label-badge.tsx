"use client";

import { LABEL_COLORS } from "@/lib/label-colors";
import { X } from "lucide-react";

interface Props {
  name: string;
  color: string;
  size?: "sm" | "md";
  onRemove?: () => void;
}

export function LabelBadge({ name, color, size = "md", onRemove }: Props) {
  const c = LABEL_COLORS[color] ?? LABEL_COLORS.gray;

  return (
    <span
      className={
        size === "sm"
          ? "label-badge inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium leading-4 whitespace-nowrap"
          : "label-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap"
      }
      style={
        {
          "--label-bg": c.bg,
          "--label-dark-bg": c.darkBg,
          backgroundColor: "var(--label-bg)",
          color: c.fg,
        } as React.CSSProperties
      }
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0 hover:opacity-70 transition-opacity"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
