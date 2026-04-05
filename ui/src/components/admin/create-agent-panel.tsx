"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { UserPlus, Mail } from "lucide-react";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateAgentPanel({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/agents/invite", { name, email, role });
      setSuccess(true);
      setTimeout(() => onCreated(), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to invite agent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="px-4 pt-6 pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Invite Agent</h2>
            <p className="text-xs text-muted-foreground">Send an email invitation to join the team</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="px-4 py-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium">Invitation sent to {email}</p>
          <p className="text-xs text-muted-foreground">They will receive an email to set their password and join the team.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <div className="flex gap-2">
              {(["agent", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                    role === r
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Mail className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            An email will be sent with a link to set their password.
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex-1" />
            <Button
              type="submit"
              size="sm"
              className="bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
