"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { InlineNotice } from "@/components/shared/inline-notice";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { CheckCircle } from "lucide-react";
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
      <AuthShell
        brandPanel={false}
        backHref={null}
        title={t.resetPassword.invalidLink}
        subtitle={t.resetPassword.invalidLinkDescription}
      >
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          {t.resetPassword.backToLogin}
        </Button>
      </AuthShell>
    );
  }

  const brand = {
    backHref: "/login",
    backLabel: t.resetPassword.backToLogin,
    tagline: t.resetPassword.tagline,
    taglineDescription: t.resetPassword.taglineDescription,
    features: [],
  };

  if (success) {
    return (
      <AuthShell
        {...brand}
        icon={<AuthStatusIcon icon={CheckCircle} />}
        title={t.resetPassword.successTitle}
        subtitle={t.resetPassword.successDescription}
      >
        <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
          {t.resetPassword.goToLogin}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...brand} title={t.resetPassword.title} subtitle={t.resetPassword.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t.resetPassword.newPassword} hint={t.resetPassword.requirements}>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
        </Field>
        <Field label={t.resetPassword.confirmPassword}>
          <Input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </Field>

        {error && <InlineNotice variant="error">{error}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? t.resetPassword.submitting : t.resetPassword.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
