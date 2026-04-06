"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { Agent, LoginResponse } from "@/types";

interface AuthState {
  agent: Pick<Agent, "id" | "name" | "email" | "role" | "requiresOnboarding"> | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  agent: null,
  accessToken: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      api.setToken(data.accessToken);
      connectSocket(data.accessToken);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("agent", JSON.stringify(data.agent));

      set({
        agent: data.agent,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Login failed", isLoading: false });
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<LoginResponse>("/auth/signup", {
        name,
        email,
        password,
      });
      api.setToken(data.accessToken);
      connectSocket(data.accessToken);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("agent", JSON.stringify(data.agent));

      set({
        agent: data.agent,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Signup failed", isLoading: false });
    }
  },

  demoLogin: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<LoginResponse>("/auth/demo-login");
      api.setToken(data.accessToken);
      connectSocket(data.accessToken);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("agent", JSON.stringify(data.agent));

      set({
        agent: data.agent,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Demo login failed", isLoading: false });
    }
  },

  googleLogin: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<LoginResponse>("/auth/google", { credential });
      api.setToken(data.accessToken);
      connectSocket(data.accessToken);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("agent", JSON.stringify(data.agent));

      set({
        agent: data.agent,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Google login failed", isLoading: false });
    }
  },

  logout: () => {
    api.setToken(null);
    disconnectSocket();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("agent");
    set({ agent: null, accessToken: null });
  },

  hydrate: () => {
    const token = localStorage.getItem("accessToken");
    const agentStr = localStorage.getItem("agent");
    if (token && agentStr) {
      const agent = JSON.parse(agentStr);
      api.setToken(token);
      connectSocket(token);
      set({ agent, accessToken: token });
    }
  },

  completeOnboarding: async () => {
    await api.patch("/auth/complete-onboarding");
    const current = useAuthStore.getState().agent;
    if (current) {
      const updated = { ...current, requiresOnboarding: false };
      localStorage.setItem("agent", JSON.stringify(updated));
      set({ agent: updated });
    }
  },
}));
