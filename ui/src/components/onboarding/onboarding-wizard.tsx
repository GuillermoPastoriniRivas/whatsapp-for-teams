"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AsisLogo } from "@/components/brand/asis-logo";
import { useAuthStore } from "@/stores/auth.store";
import { StepWelcome } from "./steps/step-welcome";
import { StepWhatsapp } from "./steps/step-whatsapp";
import { StepInvite } from "./steps/step-invite";
import { StepAi } from "./steps/step-ai";
import { StepDone } from "./steps/step-done";

const TOTAL_STEPS = 5;

export function OnboardingWizard() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(1);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [agentsInvited, setAgentsInvited] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    // If user doesn't require onboarding (e.g. navigated here manually), redirect
    if (agent && agent.requiresOnboarding !== true) {
      router.replace("/conversations");
    }
  }, [agent, router]);

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace("/conversations");
  };

  const stepContent = () => {
    switch (step) {
      case 1:
        return <StepWelcome onNext={() => setStep(2)} />;
      case 2:
        return (
          <StepWhatsapp
            onNext={() => { setPhoneConnected(true); setStep(3); }}
            onSkip={() => setStep(3)}
          />
        );
      case 3:
        return (
          <StepInvite
            onNext={() => { setAgentsInvited(true); setStep(4); }}
            onSkip={() => setStep(4)}
          />
        );
      case 4:
        return (
          <StepAi
            onNext={() => { setAiConfigured(true); setStep(5); }}
            onSkip={() => setStep(5)}
          />
        );
      case 5:
        return (
          <StepDone
            phoneConnected={phoneConnected}
            agentsInvited={agentsInvited}
            aiConfigured={aiConfigured}
            onFinish={handleFinish}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <AsisLogo size={32} color="#0D9488" />
          <span className="font-bold">
            asis<span className="text-primary">.chat</span>
          </span>
        </div>
        {step < TOTAL_STEPS && (
          <span className="text-xs text-muted-foreground">
            Paso {step} de {TOTAL_STEPS - 1}
          </span>
        )}
      </header>

      {/* Progress bar */}
      <div className="flex h-1 w-full">
        {Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 transition-colors ${
              i < step - 1 ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-5 py-10">
        <div className="w-full max-w-lg">{stepContent()}</div>
      </main>
    </div>
  );
}
