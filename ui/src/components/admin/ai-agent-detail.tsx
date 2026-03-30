"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Bot, Save, Trash2, Send } from "lucide-react";
import type { AiAgentWithConfig } from "@/types";

interface Props {
  agent: AiAgentWithConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export function AiAgentDetail({ agent, open, onOpenChange, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personaRole, setPersonaRole] = useState("");
  const [personaTone, setPersonaTone] = useState("");
  const [personaLanguage, setPersonaLanguage] = useState("");
  const [personaInstructions, setPersonaInstructions] = useState("");

  // Test
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);

  // Sync state when agent changes
  const loadAgent = (a: AiAgentWithConfig) => {
    setName(a.name);
    setKnowledgeBase(a.config.knowledgeBase || "");
    setSystemPrompt(a.config.systemPrompt || "");
    setPersonaRole(a.config.persona.role || "");
    setPersonaTone(a.config.persona.tone || "");
    setPersonaLanguage(a.config.persona.language || "");
    setPersonaInstructions(a.config.persona.instructions || "");
    setError(null);
    setSuccess(null);
    setTestResponse("");
  };

  // Load on open
  if (agent && open && name === "" && agent.name !== "") {
    loadAgent(agent);
  }

  const handleSave = async () => {
    if (!agent) return;
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
    if (!agent || !confirm("Are you sure you want to delete this AI agent?")) return;

    try {
      await api.delete(`/ai-agents/${agent.id}`);
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const handleTest = async () => {
    if (!agent || !testMessage.trim()) return;
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
    <Sheet open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) {
        setName("");
        setTestResponse("");
      }
    }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <SheetTitle>{agent?.name || "AI Agent"}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                {agent && (
                  <>
                    <Badge variant="outline" className="text-[10px]">
                      {providerLabels[agent.config.provider]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {agent.config.model}
                    </Badge>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="config" className="flex-1">Config</TabsTrigger>
            <TabsTrigger value="knowledge" className="flex-1">Knowledge</TabsTrigger>
            <TabsTrigger value="test" className="flex-1">Test</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Input
                value={personaRole}
                onChange={(e) => setPersonaRole(e.target.value)}
                placeholder="e.g., Customer support agent for Acme Corp"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <label className="text-sm font-medium">Additional Instructions</label>
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

          <TabsContent value="knowledge" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Write everything your agent needs to know. This text is sent directly to the AI as context.
            </p>
            <Textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              rows={20}
              className="font-mono text-sm"
              placeholder="Business info, services, pricing, FAQs, policies..."
            />
          </TabsContent>

          <TabsContent value="test" className="mt-4 space-y-4">
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
              <Button onClick={handleTest} disabled={testing} size="sm" className="gap-1">
                <Send className="h-4 w-4" />
                {testing ? "..." : "Send"}
              </Button>
            </div>
            {testResponse && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Response:</p>
                <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {(error || success) && (
          <div className={`mt-4 rounded-md px-3 py-2 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          }`}>
            {error || success}
          </div>
        )}

        <div className="mt-6 flex gap-2">
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
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
