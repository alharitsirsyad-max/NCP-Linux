import { create } from "zustand";

export type ToastType = "error" | "warning" | "success" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = "error") => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helper for use outside React components
export const toast = {
  error: (msg: string) => useToastStore.getState().addToast(msg, "error"),
  warn: (msg: string) => useToastStore.getState().addToast(msg, "warning"),
  success: (msg: string) => useToastStore.getState().addToast(msg, "success"),
  info: (msg: string) => useToastStore.getState().addToast(msg, "info"),
};
