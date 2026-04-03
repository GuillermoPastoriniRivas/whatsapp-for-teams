"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="p-4 space-y-4 pb-20 max-w-lg">
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

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t.settings.signOut}
      </Button>
    </div>
  );
}
