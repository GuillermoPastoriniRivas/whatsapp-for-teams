"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { InlineNotice } from "@/components/shared/inline-notice";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { CheckCircle, Users } from "lucide-react";
import { api } from "@/lib/api";

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
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
      setError(t.acceptInvite.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t.acceptInvite.error);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        brandPanel={false}
        backHref={null}
        title={t.acceptInvite.invalidLink}
        subtitle={t.acceptInvite.invalidLinkDescription}
      >
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          {t.acceptInvite.goToLogin}
        </Button>
      </AuthShell>
    );
  }

  const brand = {
    backHref: null,
    tagline: t.acceptInvite.tagline,
    taglineDescription: t.acceptInvite.taglineDescription,
    features: [{ icon: Users, label: t.acceptInvite.featureTeam }],
  };

  if (success) {
    return (
      <AuthShell
        {...brand}
        icon={<AuthStatusIcon icon={CheckCircle} />}
        title={t.acceptInvite.successTitle}
        subtitle={t.acceptInvite.successDescription}
      >
        <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
          {t.acceptInvite.goToLogin}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...brand} title={t.acceptInvite.title} subtitle={t.acceptInvite.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t.acceptInvite.createPassword} hint={t.acceptInvite.requirements}>
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
        <Field label={t.acceptInvite.confirmPassword}>
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
          {loading ? t.acceptInvite.submitting : t.acceptInvite.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
