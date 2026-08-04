"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { InlineNotice } from "@/components/shared/inline-notice";
import { AuthDivider, AuthShell } from "@/components/auth/auth-shell";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = emailRef.current?.value ?? "";
    const passwordValue = passwordRef.current?.value ?? "";
    await login(emailValue, passwordValue);
    if (useAuthStore.getState().agent) {
      router.push("/conversations");
    }
  };

  const handleDemoLogin = async () => {
    await demoLogin();
    if (useAuthStore.getState().agent) {
      router.push("/conversations");
    }
  };

  const handleGoogleSuccess = async (response: { credential?: string }) => {
    if (response.credential) {
      await googleLogin(response.credential);
      if (useAuthStore.getState().agent) {
        router.push("/conversations");
      }
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthShell
        title={t.login.title}
        subtitle={t.login.subtitle}
        footer={
          <>
            {t.login.noAccount}{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              {t.login.signupLink}
            </Link>
          </>
        }
      >
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            width="384"
            shape="pill"
            size="large"
            theme="filled_blue"
            text="signin_with"
          />
        </div>

        <AuthDivider>o</AuthDivider>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.login.email}>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              placeholder={t.login.emailPlaceholder}
              name="email"
              required
              autoFocus
            />
          </Field>
          <div className="space-y-1.5">
            <Field label={t.login.password}>
              <Input
                ref={passwordRef}
                id="password"
                type="password"
                placeholder="••••••••"
                name="password"
                required
              />
            </Field>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {t.login.forgotPassword}
              </Link>
            </div>
          </div>
          {error && <InlineNotice variant="error">{error}</InlineNotice>}
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? t.login.submitting : t.login.submit}
          </Button>
        </form>

        <AuthDivider>{t.login.demoDivider}</AuthDivider>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleDemoLogin}
          disabled={isLoading}
        >
          {isLoading ? t.login.demoLoading : t.login.demoButton}
        </Button>
      </AuthShell>
    </GoogleOAuthProvider>
  );
}
