"use client";

import { ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useZoomStore, ZOOM_OPTIONS } from "@/stores/zoom.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

export function ZoomSettingsCard() {
  const { t } = useTranslations();
  const zoom = useZoomStore((s) => s.zoom);
  const hydrated = useZoomStore((s) => s.hydrated);
  const setZoom = useZoomStore((s) => s.setZoom);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ZoomIn className="h-4 w-4" />
          {t.settings.zoomTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t.settings.zoomHint}</p>
        <div className="flex flex-wrap gap-1.5">
          {ZOOM_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              variant={hydrated && option === zoom ? "default" : "outline"}
              size="sm"
              className={cn("min-w-16", !hydrated && "opacity-70")}
              onClick={() => setZoom(option)}
            >
              {Math.round(option * 100)}%
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
