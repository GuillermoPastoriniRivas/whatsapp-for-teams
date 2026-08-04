"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { InlineNotice } from "@/components/shared/inline-notice";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || t.forgotPassword.error);
    } finally {
      setLoading(false);
    }
  };

  const brand = {
    backHref: "/login",
    backLabel: t.forgotPassword.backToLogin,
    tagline: t.forgotPassword.tagline,
    taglineDescription: t.forgotPassword.taglineDescription,
    features: [],
  };

  if (sent) {
    return (
      <AuthShell
        {...brand}
        icon={<AuthStatusIcon icon={Mail} />}
        title={t.forgotPassword.sentTitle}
        subtitle={t.forgotPassword.sentDescription}
      >
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          {t.forgotPassword.backToLogin}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...brand} title={t.forgotPassword.title} subtitle={t.forgotPassword.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t.login.email}>
          <Input
            id="email"
            type="email"
            placeholder={t.login.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>

        {error && <InlineNotice variant="error">{error}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? t.forgotPassword.submitting : t.forgotPassword.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
