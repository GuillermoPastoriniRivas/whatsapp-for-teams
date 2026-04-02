"use client";

import { useLocaleStore, type Locale } from "@/stores/locale.store";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const options: { value: Locale; label: string }[] = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export function LanguageToggle({ collapsed }: { collapsed?: boolean }) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        collapsed ? "justify-center" : "px-3"
      )}
    >
      {collapsed ? (
        <button
          onClick={() => setLocale(locale === "es" ? "en" : "es")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={locale === "es" ? "Switch to English" : "Cambiar a Espanol"}
        >
          <Globe className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex items-center gap-2 w-full">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocale(opt.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  locale === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
