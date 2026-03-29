"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hexagon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read directly from DOM refs to avoid stale closure issues
    // with React Compiler memoization
    const emailValue = emailRef.current?.value ?? "";
    const passwordValue = passwordRef.current?.value ?? "";
    await login(emailValue, passwordValue);
    if (useAuthStore.getState().agent) {
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#0D9488] to-[#0F766E]">
            <Hexagon className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">Hivvo.chat</CardTitle>
          <CardDescription>Sign in to your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              ref={emailRef}
              type="email"
              placeholder="Email"
              name="email"
              required
              autoFocus
            />
            <Input
              ref={passwordRef}
              type="password"
              placeholder="Password"
              name="password"
              required
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
