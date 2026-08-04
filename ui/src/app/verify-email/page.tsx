"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { t } = useTranslations();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") {
    return (
      <AuthShell
        brandPanel={false}
        backHref={null}
        icon={<Spinner className="mx-auto size-10 text-primary" />}
        title={t.verifyEmail.title}
        subtitle={t.verifyEmail.loading}
      >
        {null}
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell
        brandPanel={false}
        backHref={null}
        icon={<AuthStatusIcon icon={CheckCircle} />}
        title={t.verifyEmail.successTitle}
        subtitle={t.verifyEmail.successDescription}
      >
        <Button size="lg" className="w-full" onClick={() => router.push("/conversations")}>
          {t.verifyEmail.goToApp}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      brandPanel={false}
      backHref={null}
      icon={<AuthStatusIcon icon={XCircle} tone="destructive" />}
      title={t.verifyEmail.errorTitle}
      subtitle={t.verifyEmail.errorDescription}
    >
      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        {t.verifyEmail.backToLogin}
      </Link>
    </AuthShell>
  );
}
