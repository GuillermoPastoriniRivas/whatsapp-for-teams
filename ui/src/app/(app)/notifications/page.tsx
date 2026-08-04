"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useTranslations } from "@/lib/i18n/use-translations";

/**
 * Todavía no hay backend de notificaciones. Hasta que lo haya, la pantalla
 * queda fuera de la navegación y muestra un estado vacío honesto en vez de los
 * datos de ejemplo que traía.
 */
export default function NotificationsPage() {
  const { t } = useTranslations();

  return (
    <PageShell>
      <PageHeader title={t.notifications.title} subtitle={t.notifications.subtitle} />

      <PageContent width="narrow">
        <EmptyState
          icon={Bell}
          title={t.notifications.emptyTitle}
          description={t.notifications.emptyBody}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">{t.notifications.pushSettings}</Link>
            </Button>
          }
        />
      </PageContent>
    </PageShell>
  );
}
