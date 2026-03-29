"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, PhoneNumber } from "@/types";

interface PhoneAccessItem {
  id: string;
  phoneNumberId?: string;
}

export function PhoneAccessManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, phoneList] = await Promise.all([
        api.get<Agent[]>("/agents"),
        api.get<PhoneNumber[]>("/phone-numbers"),
      ]);
      setAgents(agentList);
      setPhones(phoneList);

      const map: Record<string, Set<string>> = {};
      await Promise.all(
        agentList.map(async (agent) => {
          try {
            const access = await api.get<PhoneAccessItem[]>(
              `/agents/${agent.id}/phone-access`
            );
            map[agent.id] = new Set(access.map((a) => a.id));
          } catch {
            map[agent.id] = new Set();
          }
        })
      );
      setAccessMap(map);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAccess = async (agentId: string, phoneId: string) => {
    const key = `${agentId}-${phoneId}`;
    setUpdating(key);
    const hasAccess = accessMap[agentId]?.has(phoneId);

    try {
      if (hasAccess) {
        await api.delete(`/agents/${agentId}/phone-access/${phoneId}`);
      } else {
        await api.post(`/agents/${agentId}/phone-access`, {
          phoneNumberId: phoneId,
        });
      }
      setAccessMap((prev) => {
        const set = new Set(prev[agentId]);
        hasAccess ? set.delete(phoneId) : set.add(phoneId);
        return { ...prev, [agentId]: set };
      });
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const grantAll = async (agentId: string) => {
    setUpdating(`bulk-${agentId}`);
    try {
      const current = accessMap[agentId] || new Set();
      const missing = phones.filter((p) => !current.has(p.id));
      await Promise.all(
        missing.map((p) =>
          api.post(`/agents/${agentId}/phone-access`, {
            phoneNumberId: p.id,
          })
        )
      );
      setAccessMap((prev) => ({
        ...prev,
        [agentId]: new Set(phones.map((p) => p.id)),
      }));
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const revokeAll = async (agentId: string) => {
    setUpdating(`bulk-${agentId}`);
    try {
      const current = accessMap[agentId] || new Set();
      await Promise.all(
        Array.from(current).map((phoneId) =>
          api.delete(`/agents/${agentId}/phone-access/${phoneId}`)
        )
      );
      setAccessMap((prev) => ({ ...prev, [agentId]: new Set() }));
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (agents.length === 0 || phones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {agents.length === 0
          ? "No agents found. Create agents first."
          : "No phone numbers registered. Add numbers first."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Phone Access</h2>
      <div className="space-y-3">
        {agents.map((agent) => {
          const agentAccess = accessMap[agent.id] || new Set();
          const isBulkUpdating = updating === `bulk-${agent.id}`;

          return (
            <div
              key={agent.id}
              className="rounded-lg border overflow-hidden"
            >
              {/* Agent header */}
              <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {agentAccess.size} of {phones.length} numbers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => grantAll(agent.id)}
                    disabled={isBulkUpdating}
                  >
                    Grant all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => revokeAll(agent.id)}
                    disabled={isBulkUpdating}
                  >
                    Revoke all
                  </Button>
                </div>
              </div>

              {/* Phone toggles */}
              <div className="divide-y">
                {phones.map((phone) => {
                  const hasAccess = agentAccess.has(phone.id);
                  const isUpdating =
                    updating === `${agent.id}-${phone.id}`;

                  return (
                    <button
                      key={phone.id}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => toggleAccess(agent.id, phone.id)}
                      disabled={isUpdating}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{phone.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {phone.displayPhone}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                          hasAccess
                            ? "bg-primary border-primary text-white"
                            : "border-slate-300 dark:border-slate-600",
                          isUpdating && "opacity-50"
                        )}
                      >
                        {hasAccess && <Check className="h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
