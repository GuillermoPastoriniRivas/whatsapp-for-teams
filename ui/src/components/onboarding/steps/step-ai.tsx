"use client";

// Paso de IA del onboarding: en vez de pedir datos sueltos y dejar el bot a
// medio armar ("después lo completás"), corre el alta guiada y sale de acá un
// asistente que ya contesta. Ese es el momento de activación que importa.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AssistantSetup, AssistantSetupResult } from "@/components/flows/assistant-setup";

interface StepAiProps {
  onNext: () => void;
  onSkip: () => void;
}

interface SetupResult {
  aiAgentId: string;
  flowId: string;
  published: boolean;
  publishBlockedReason: string | null;
}

export function StepAi({ onNext, onSkip }: StepAiProps) {
  const router = useRouter();
  const [result, setResult] = useState<SetupResult | null>(null);

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <AssistantSetupResult
          result={result}
          onOpenFlow={() => router.push(`/flows/${result.flowId}`)}
          onGoToInbox={onNext}
        />
        <button
          onClick={onNext}
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Seguir con el onboarding
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AssistantSetup onDone={setResult} />
      <button
        onClick={onSkip}
        className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Lo hago después
      </button>
    </div>
  );
}
