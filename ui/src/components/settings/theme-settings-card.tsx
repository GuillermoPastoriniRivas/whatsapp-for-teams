"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeStore, type ThemePreference } from "@/stores/theme.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; icon: typeof Sun; labelKey: "themeLight" | "themeDark" | "themeSystem" }[] = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
];

export function ThemeSettingsCard() {
  const { t } = useTranslations();
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="h-4 w-4" />
          {t.settings.themeTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t.settings.themeHint}</p>
        <div className="flex flex-wrap gap-1.5">
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={hydrated && option.value === theme ? "default" : "outline"}
              size="sm"
              className={cn(!hydrated && "opacity-70")}
              aria-pressed={hydrated && option.value === theme}
              onClick={() => setTheme(option.value)}
            >
              <option.icon className="size-4" />
              {t.settings[option.labelKey]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
