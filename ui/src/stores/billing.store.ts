"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  PlanTier,
  Subscription,
  BillingRecord,
  PlanUsage,
  SubscriptionInfo,
} from "@/types";

interface BillingState {
  subscription: Subscription | null;
  plan: PlanTier;
  limits: SubscriptionInfo["limits"] | null;
  usage: PlanUsage | null;
  history: BillingRecord[];
  isLoading: boolean;

  fetchSubscription: () => Promise<void>;
  subscribe: (plan: PlanTier) => Promise<void>;
  changePlan: (newPlan: PlanTier) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  toggleResource: (resourceType: string, activateId: string, deactivateId?: string) => Promise<boolean>;
}

export const useBillingStore = create<BillingState>((set) => ({
  subscription: null,
  plan: "free",
  limits: null,
  usage: null,
  history: [],
  isLoading: false,

  fetchSubscription: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<SubscriptionInfo>("/billing/subscription");
      set({
        subscription: data.subscription,
        plan: data.plan,
        limits: data.limits,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  subscribe: async (plan) => {
    set({ isLoading: true });
    try {
      const sub = await api.post<Subscription>("/billing/subscribe", { plan });
      set({ subscription: sub, plan: sub.plan, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  changePlan: async (newPlan) => {
    set({ isLoading: true });
    try {
      const sub = await api.patch<Subscription>("/billing/plan", { newPlan });
      set({ subscription: sub, plan: sub.plan, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  cancelSubscription: async () => {
    set({ isLoading: true });
    try {
      const sub = await api.post<Subscription>("/billing/cancel");
      set({ subscription: sub, plan: sub.plan, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchHistory: async () => {
    try {
      const data = await api.get<BillingRecord[]>("/billing/history");
      set({ history: data });
    } catch {
      // ignore
    }
  },

  fetchUsage: async () => {
    try {
      const data = await api.get<PlanUsage>("/billing/usage");
      set({ usage: data });
    } catch {
      // ignore
    }
  },

  toggleResource: async (resourceType, activateId, deactivateId) => {
    try {
      await api.post("/billing/toggle-resource", { resourceType, activateId, deactivateId });
      return true;
    } catch {
      return false;
    }
  },
}));
