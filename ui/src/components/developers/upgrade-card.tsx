"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";

export function UpgradeCard({ body }: { body: string }) {
  const { t } = useTranslations();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">{t.developers.upgradeTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/settings/billing">{t.developers.upgradeCta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
