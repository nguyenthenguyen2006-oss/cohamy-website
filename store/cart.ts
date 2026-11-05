"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  acceptPrices: (prices: {productId:string;price:number}[]) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.productId === item.productId,
          );

          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            const existing = updatedItems[existingIndex];
            updatedItems[existingIndex] = {
              ...existing,
              quantity: Math.min(100, existing.quantity + quantity),
            };
            return { items: updatedItems };
          }

          return {
            items: [...state.items, { ...item, quantity: Math.min(100,Math.max(1,Math.trunc(quantity))) }],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId ? { ...item, quantity:Math.min(100,Math.max(1,Math.trunc(quantity))) } : item,
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      acceptPrices: (prices) => set(state=>({items:state.items.map(item=>{const price=prices.find(row=>row.productId===item.productId);return price?{...item,price:price.price}:item;})})),

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "cohamy-cart",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
