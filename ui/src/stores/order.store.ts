"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Order, OrderStatus, PaginatedResponse } from "@/types";

interface OrderState {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
  statusFilter: OrderStatus | "";
  isLoading: boolean;
  fetch: (status?: OrderStatus | "", page?: number) => Promise<void>;
  setFilter: (status: OrderStatus | "") => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Partial<Order> & { id: string }) => void;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  total: 0,
  page: 1,
  pages: 1,
  statusFilter: "",
  isLoading: false,

  fetch: async (status?: OrderStatus | "", page = 1) => {
    set({ isLoading: true });
    try {
      const filter = status ?? get().statusFilter;
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (filter) params.set("status", filter);

      const data = await api.get<PaginatedResponse<Order>>(
        `/orders?${params}`
      );
      set({
        orders: data.data,
        total: data.meta.total,
        page: data.meta.page,
        pages: data.meta.pages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setFilter: (status) => {
    set({ statusFilter: status });
    get().fetch(status);
  },

  addOrder: (order) => {
    set((state) => ({
      orders: [order, ...state.orders],
      total: state.total + 1,
    }));
  },

  updateOrder: (order) => {
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === order.id ? { ...o, ...order } : o
      ),
    }));
  },

  updateStatus: async (orderId, status) => {
    try {
      const updated = await api.patch<Order>(`/orders/${orderId}/status`, {
        status,
      });
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
      }));
    } catch {
      // ignore
    }
  },
}));
