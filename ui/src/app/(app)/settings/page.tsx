"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PushSettingsCard } from "@/components/pwa/push-settings-card";
import { PasswordSettingsCard } from "@/components/settings/password-settings-card";
import { BusinessProfileCard } from "@/components/settings/business-profile-card";
import { ProvidersCard } from "@/components/settings/providers-card";
import { ZoomSettingsCard } from "@/components/settings/zoom-settings-card";
import { ThemeSettingsCard } from "@/components/settings/theme-settings-card";
import { LogOut, User } from "lucide-react";

export default function SettingsPage() {
  const { agent, logout } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslations();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <PageShell>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <PageContent width="narrow">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                {t.settings.profile}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t.settings.name}:</span>{" "}
                {agent?.name}
              </div>
              <div>
                <span className="text-muted-foreground">{t.settings.email}:</span>{" "}
                {agent?.email}
              </div>
              <div>
                <span className="text-muted-foreground">{t.settings.role}:</span>{" "}
                {agent?.role}
              </div>
            </CardContent>
          </Card>

          <BusinessProfileCard />

          <ProvidersCard />

          <PasswordSettingsCard />

          <ThemeSettingsCard />

          <ZoomSettingsCard />

          <PushSettingsCard />

          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t.settings.signOut}
          </Button>
        </div>
      </PageContent>
    </PageShell>
  );
}
