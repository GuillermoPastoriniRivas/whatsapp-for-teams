"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";

export function PasswordSettingsCard() {
  const { t } = useTranslations();
  const setPassword = useAuthStore((s) => s.setPassword);

  // null mientras no sabemos si la cuenta ya tiene contraseña
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get<{ hasPassword: boolean }>("/auth/me")
      .then((me) => setHasPassword(me.hasPassword))
      .catch(() => setHasPassword(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const current = (form.get("currentPassword") as string) || undefined;
    const next = form.get("password") as string;
    const repeat = form.get("repeatPassword") as string;

    if (next !== repeat) {
      setError(t.settings.passwordMismatch);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await setPassword(next, hasPassword ? current : undefined);
      setDone(true);
      setOpen(false);
      setHasPassword(true);
    } catch (err: any) {
      setError(err?.message || t.settings.passwordError);
    } finally {
      setBusy(false);
    }
  };

  if (hasPassword === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {hasPassword ? t.settings.password : t.settings.passwordCreateTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {hasPassword
            ? t.settings.passwordChangeDescription
            : t.settings.passwordCreateDescription}
        </p>

        {done && !open && (
          <p className="text-primary">
            {hasPassword ? t.settings.passwordSavedChange : t.settings.passwordSaved}
          </p>
        )}

        {!open && (
          <Button
            variant={hasPassword ? "outline" : "default"}
            onClick={() => {
              setOpen(true);
              setDone(false);
              setError(null);
            }}
            className="w-full sm:w-auto"
          >
            {hasPassword ? t.settings.passwordEdit : t.settings.passwordCreateSubmit}
          </Button>
        )}

        {open && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {hasPassword && (
              <div className="space-y-1.5">
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-medium text-foreground"
                >
                  {t.settings.passwordCurrent}
                </label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                {t.settings.passwordNew}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={8}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t.settings.passwordRules}</p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="repeatPassword"
                className="text-sm font-medium text-foreground"
              >
                {t.settings.passwordRepeat}
              </label>
              <Input
                id="repeatPassword"
                name="repeatPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy
                  ? t.settings.passwordSaving
                  : hasPassword
                    ? t.settings.passwordChangeSubmit
                    : t.settings.passwordCreateSubmit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                {t.settings.passwordCancel}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
