"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsisLogo } from "@/components/brand/asis-logo";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { t } = useTranslations();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t.resetPassword.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t.resetPassword.error);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
        <div className="text-center space-y-4">
          <AsisLogo size={72} color="#0D9488" className="mx-auto mb-3" />
          <h2 className="text-2xl font-bold">{t.resetPassword.invalidLink}</h2>
          <p className="text-muted-foreground">{t.resetPassword.invalidLinkDescription}</p>
          <Button
            variant="outline"
            className="mt-4 h-12 rounded-xl text-base"
            onClick={() => router.push("/login")}
          >
            {t.resetPassword.backToLogin}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
        <div className="flex items-center gap-2">
          <AsisLogo size={44} color="#0D9488" />
          <span className="text-xl font-bold -ml-1">asis<span className="opacity-80">.chat</span></span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
              {t.resetPassword.tagline}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed opacity-80">
              {t.resetPassword.taglineDescription}
            </p>
          </div>
        </div>

        <p className="text-xs opacity-50">
          &copy; {new Date().getFullYear()} asis.chat
        </p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col bg-background md:w-1/2">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <button
            onClick={() => router.push("/login")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95 min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            {t.resetPassword.backToLogin}
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="flex items-center gap-1.5 md:hidden">
              <AsisLogo size={36} color="#0D9488" />
              <span className="text-lg font-bold">asis<span className="text-primary">.chat</span></span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-8 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center mb-10 md:hidden">
              <AsisLogo size={72} color="#0D9488" className="mb-3" />
            </div>

            {success ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {t.resetPassword.successTitle}
                </h2>
                <p className="text-muted-foreground">
                  {t.resetPassword.successDescription}
                </p>
                <Button
                  className="mt-4 h-12 w-full rounded-xl text-base font-semibold"
                  onClick={() => router.push("/login")}
                >
                  {t.resetPassword.goToLogin}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {t.resetPassword.title}
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    {t.resetPassword.subtitle}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      {t.resetPassword.newPassword}
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      className="h-12 text-base px-4 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                      {t.resetPassword.confirmPassword}
                    </label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 text-base px-4 rounded-xl"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t.resetPassword.requirements}
                  </p>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold rounded-xl mt-2"
                    disabled={loading}
                  >
                    {loading ? t.resetPassword.submitting : t.resetPassword.submit}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
