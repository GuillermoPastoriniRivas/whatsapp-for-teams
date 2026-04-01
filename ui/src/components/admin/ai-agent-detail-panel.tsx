"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Bot, Save, Trash2, Send, Eye, EyeOff } from "lucide-react";
import type { AiAgentWithConfig } from "@/types";

type ProviderValue = "openai" | "anthropic" | "gemini" | "openrouter";

const providers: { value: ProviderValue; label: string; models: string[] }[] = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"] },
  { value: "gemini", label: "Gemini", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] },
  { value: "openrouter", label: "OpenRouter", models: [] },
];

interface Props {
  agent: AiAgentWithConfig;
  onUpdated: () => void;
  onDeleted: () => void;
}

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export function AiAgentDetailPanel({ agent, onUpdated, onDeleted }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(agent.name);
  const [knowledgeBase, setKnowledgeBase] = useState(agent.config.knowledgeBase || "");
  const [systemPrompt, setSystemPrompt] = useState(agent.config.systemPrompt || "");
  const [personaRole, setPersonaRole] = useState(agent.config.persona.role || "");
  const [personaTone, setPersonaTone] = useState(agent.config.persona.tone || "");
  const [personaLanguage, setPersonaLanguage] = useState(agent.config.persona.language || "");
  const [personaInstructions, setPersonaInstructions] = useState(agent.config.persona.instructions || "");

  const [provider, setProvider] = useState(agent.config.provider || "openai");
  const [model, setModel] = useState(agent.config.model || "");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const selectedProvider = providers.find((p) => p.value === provider);

  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);

  // Reset state when agent changes
  useEffect(() => {
    setName(agent.name);
    setKnowledgeBase(agent.config.knowledgeBase || "");
    setSystemPrompt(agent.config.systemPrompt || "");
    setPersonaRole(agent.config.persona.role || "");
    setPersonaTone(agent.config.persona.tone || "");
    setPersonaLanguage(agent.config.persona.language || "");
    setPersonaInstructions(agent.config.persona.instructions || "");
    setProvider(agent.config.provider || "openai");
    setModel(agent.config.model || "");
    setApiKey("");
    setShowApiKey(false);
    setError(null);
    setSuccess(null);
    setTestResponse("");
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, any> = {
        name,
        provider,
        model,
        knowledgeBase,
        systemPrompt,
        persona: {
          role: personaRole,
          tone: personaTone,
          language: personaLanguage,
          instructions: personaInstructions,
        },
      };
      if (apiKey.trim()) {
        payload.apiKey = apiKey;
      }
      await api.patch(`/ai-agents/${agent.id}`, payload);
      setSuccess("Saved successfully");
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this AI agent?")) return;

    try {
      await api.delete(`/ai-agents/${agent.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse("");

    try {
      const result = await api.post<{ response: string; tokensUsed: any }>(
        `/ai-agents/${agent.id}/test`,
        { message: testMessage }
      );
      setTestResponse(result.response);
    } catch (err: any) {
      setTestResponse(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{agent.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-5">
                {providerLabels[provider]}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5">
                {model}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="config" className="flex-1 text-xs">Config</TabsTrigger>
            <TabsTrigger value="knowledge" className="flex-1 text-xs">Knowledge</TabsTrigger>
            <TabsTrigger value="test" className="flex-1 text-xs">Test</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* AI Provider Settings */}
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
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
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
              <label className="text-sm font-medium">Model</label>
              {selectedProvider && selectedProvider.models.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProvider.models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
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
                  className="text-sm"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={agent.config.apiKeySet ? "••••••••  (leave empty to keep current)" : "sk-..."}
                  className="pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {agent.config.apiKeySet
                  ? "A key is already set. Enter a new one only if you want to replace it."
                  : "No API key set. Enter one to enable the agent."}
              </p>
            </div>

            <hr className="my-1" />

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Input
                value={personaRole}
                onChange={(e) => setPersonaRole(e.target.value)}
                placeholder="e.g., Customer support agent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tone</label>
                <Input value={personaTone} onChange={(e) => setPersonaTone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Language</label>
                <Input value={personaLanguage} onChange={(e) => setPersonaLanguage(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Instructions</label>
              <Textarea
                value={personaInstructions}
                onChange={(e) => setPersonaInstructions(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">System Prompt Override</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                placeholder="Advanced: override the auto-generated system prompt"
              />
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Write everything your agent needs to know. This text is sent directly to the AI as context.
            </p>
            <Textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              rows={14}
              className="font-mono text-sm"
              placeholder="Business info, services, pricing, FAQs, policies..."
            />
          </TabsContent>

          <TabsContent value="test" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Send a test message to see how your AI agent responds.
            </p>
            <div className="flex gap-2">
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Type a test message..."
                onKeyDown={(e) => e.key === "Enter" && handleTest()}
              />
              <Button onClick={handleTest} disabled={testing} size="sm" className="gap-1 shrink-0">
                <Send className="h-4 w-4" />
                {testing ? "..." : "Send"}
              </Button>
            </div>
            {testResponse && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Response:</p>
                <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {(error || success) && (
          <div className={`mt-3 rounded-md px-3 py-2 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          }`}>
            {error || success}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
