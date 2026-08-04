"use client";

import { ExternalLink, ImageIcon, Reply } from "lucide-react";

import { cn } from "@/lib/utils";
import { renderTemplateText, TEMPLATE_PLACEHOLDER_RE } from "@/lib/template-utils";
import type { TemplateComponent } from "@/types";

interface TemplatePreviewProps {
  components: TemplateComponent[];
  /** Resolved variable values keyed as body.1 / header.1 / header.link — tokens without a value render as chips. */
  values?: Record<string, string>;
  /** Canonical keys of variables that resolved to nothing for the sample contact (rendered in red). */
  missingKeys?: string[];
  className?: string;
}

/** Renders text with unresolved {{tokens}} as highlighted chips. */
function TokenizedText({
  text,
  prefix,
  values,
  missingKeys,
}: {
  text: string;
  prefix: "header" | "body";
  values: Record<string, string>;
  missingKeys: Set<string>;
}) {
  const substituted = renderTemplateText(text, prefix, values);
  const parts = substituted.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
        if (!match) return <span key={i}>{part}</span>;
        const key = `${prefix}.${match[1]}`;
        const missing = missingKeys.has(key);
        return (
          <span
            key={i}
            className={cn(
              "mx-0.5 rounded px-1 py-px font-mono text-xs",
              missing
                ? "bg-destructive/15 text-destructive"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            )}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

export function TemplatePreview({ components, values = {}, missingKeys = [], className }: TemplatePreviewProps) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
  const missing = new Set(missingKeys);
  const time = "10:30";

  return (
    <div
      className={cn(
        "rounded-lg bg-[var(--asis-surface-panel)] p-4",
        className
      )}
    >
      <div className="relative max-w-[290px] rounded-lg rounded-tl-none bg-[var(--asis-bubble-inbound)] px-2.5 py-2 shadow-sm">
        {header && (header.format ?? "TEXT") === "TEXT" && header.text && (
          <p className="mb-1 text-sm font-semibold text-foreground">
            <TokenizedText text={header.text} prefix="header" values={values} missingKeys={missing} />
          </p>
        )}
        {header && header.format && header.format !== "TEXT" && (
          <div className="mb-1.5 flex h-24 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {body?.text ? (
            <TokenizedText text={body.text} prefix="body" values={values} missingKeys={missing} />
          ) : (
            <span className="text-muted-foreground">…</span>
          )}
        </p>
        {footer?.text && (
          <p className="mt-1 text-xs text-muted-foreground">{footer.text}</p>
        )}
        <p className="mt-0.5 text-right text-xs text-muted-foreground">{time}</p>
        {buttons.length > 0 && (
          <div className="-mx-2.5 mt-1.5 border-t border-border">
            {buttons.map((button, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-sky-600 dark:text-sky-400",
                  i > 0 && "border-t border-border"
                )}
              >
                {button.type === "URL" ? <ExternalLink className="size-3.5" /> : <Reply className="size-3.5" />}
                <span className="truncate">{button.text || "…"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** True when the template has at least one placeholder (used to skip the variables step). */
export function templateHasPlaceholders(components: TemplateComponent[]): boolean {
  // match() instead of .test(): the shared regex has the /g flag, which makes .test() stateful
  const has = (text?: string) => !!text?.match(TEMPLATE_PLACEHOLDER_RE)?.length;
  return components.some(
    (c) =>
      has(c.text) ||
      (c.buttons ?? []).some((b) => has(b.url)) ||
      (c.type === "HEADER" && c.format && c.format !== "TEXT")
  );
}
