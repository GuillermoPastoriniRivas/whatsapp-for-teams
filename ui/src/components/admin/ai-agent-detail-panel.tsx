"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Bot, Save, Trash2, Send } from "lucide-react";
import type { AiAgentWithConfig } from "@/types";

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
    setError(null);
    setSuccess(null);
    setTestResponse("");
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/ai-agents/${agent.id}`, {
        name,
        knowledgeBase,
        systemPrompt,
        persona: {
          role: personaRole,
          tone: personaTone,
          language: personaLanguage,
          instructions: personaInstructions,
        },
      });
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
                {providerLabels[agent.config.provider]}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5">
                {agent.config.model}
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
