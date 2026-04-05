"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { AsisLogo } from "@/components/brand/asis-logo";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
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

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <AsisLogo size={56} color="#0D9488" />
        </div>

        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t.verifyEmail.loading}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t.verifyEmail.successTitle}</h1>
            <p className="text-muted-foreground mb-6">
              {t.verifyEmail.successDescription}
            </p>
            <Button
              className="w-full h-12 text-base font-semibold rounded-xl"
              onClick={() => router.push("/conversations")}
            >
              {t.verifyEmail.goToApp}
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t.verifyEmail.errorTitle}</h1>
            <p className="text-muted-foreground mb-6">
              {t.verifyEmail.errorDescription}
            </p>
            <Link href="/login" className="text-primary font-medium hover:underline text-sm">
              {t.verifyEmail.backToLogin}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
