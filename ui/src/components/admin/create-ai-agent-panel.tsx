"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

const providers = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"] },
  { value: "gemini", label: "Gemini", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] },
  { value: "openrouter", label: "OpenRouter", models: [] },
];

const tones = ["friendly", "professional", "casual", "formal"];
const languages = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "auto", label: "Auto-detect" },
];

export function CreateAiAgentPanel({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [role, setRole] = useState("");
  const [tone, setTone] = useState("friendly");
  const [language, setLanguage] = useState("es");
  const [instructions, setInstructions] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");

  const totalSteps = 4;
  const selectedProvider = providers.find((p) => p.value === provider);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      await api.post("/ai-agents", {
        name,
        provider,
        model,
        apiKey,
        knowledgeBase,
        persona: { role, tone, language, instructions },
        handoffRules: { onCustomerRequest: true, maxConsecutiveFailures: 3 },
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create AI agent");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return apiKey.trim().length > 0 && model.trim().length > 0;
      case 3: return role.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">New AI Agent</h2>
            <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < step ? "bg-violet-500" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-4">
        {step === 1 && (
          <>
            <h3 className="font-medium text-sm">Agent Identity</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g., "Ana", "Support Bot"'
              />
              <p className="text-xs text-muted-foreground">
                This is how the agent will be identified in the system.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-medium text-sm">AI Provider</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setProvider(p.value);
                      if (p.models.length > 0) setModel(p.models[0]);
                      else setModel("");
                    }}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      provider === p.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted and stored securely.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model</label>
              {selectedProvider && selectedProvider.models.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedProvider.models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                        model === m
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., openai/gpt-4o"
                />
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-medium text-sm">Personality</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder='e.g., "Customer support agent"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tone</label>
              <div className="flex flex-wrap gap-2">
                {tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                      tone === t
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Language</label>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLanguage(l.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      language === l.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Additional Instructions</label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Any specific instructions for the agent..."
                rows={3}
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="font-medium text-sm">Knowledge Base</h3>
            <p className="text-sm text-muted-foreground">
              Write everything your agent needs to know about your business.
            </p>
            <Textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder={`Example:\n\nWe are Acme Corp, a dental clinic.\nHours: Mon-Fri 9am-6pm\nServices: Cleaning ($50), Filling ($120)\n\nFAQ:\nQ: Do you accept insurance?\nA: Yes, most major plans.`}
              rows={10}
              className="font-mono text-sm"
            />
          </>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(step - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <div className="flex-1" />
          {step < totalSteps ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="gap-1 bg-primary hover:bg-primary/90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
