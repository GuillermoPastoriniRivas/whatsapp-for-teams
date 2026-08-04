"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { InlineNotice } from "@/components/shared/inline-notice";
import { AuthDivider, AuthShell } from "@/components/auth/auth-shell";
import { Bot, MessageSquare, Users } from "lucide-react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeError = useAuthStore((s) => s.error);
  const { t } = useTranslations();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError(t.signup.passwordMismatch);
      return;
    }

    await signup(name, email, password);

    const state = useAuthStore.getState();
    if (state.error) {
      if (state.error.toLowerCase().includes("already")) {
        setFormError(t.signup.emailTaken);
      } else {
        setFormError(state.error);
      }
      return;
    }

    if (state.agent) {
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

  const displayError = formError ?? storeError;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthShell
        title={t.signup.title}
        subtitle={t.signup.subtitle}
        tagline={t.signup.tagline}
        taglineDescription={t.signup.taglineDescription}
        features={[
          { icon: MessageSquare, label: t.signup.featureInbox },
          { icon: Bot, label: t.signup.featureAI },
          { icon: Users, label: t.signup.featureTeam },
        ]}
        footer={
          <>
            {t.signup.alreadyHaveAccount}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t.signup.loginLink}
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
            text="signup_with"
          />
        </div>

        <AuthDivider>{t.signup.divider}</AuthDivider>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.signup.name}>
            <Input
              id="name"
              type="text"
              placeholder={t.signup.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label={t.signup.email}>
            <Input
              id="email"
              type="email"
              placeholder={t.signup.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t.signup.password}>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Field label={t.signup.confirmPassword}>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>

          {displayError && <InlineNotice variant="error">{displayError}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? t.signup.submitting : t.signup.submit}
          </Button>
        </form>
      </AuthShell>
    </GoogleOAuthProvider>
  );
}
