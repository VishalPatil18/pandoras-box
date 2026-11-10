"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

const TOAST_MS = 5_000;

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast needs a ToastProvider above it");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div role="status" aria-live="polite" className="fixed bottom-6 left-4 z-20 md:left-12">
        {message && (
          <p className="flex max-w-[min(520px,calc(100vw-32px))] animate-in items-center gap-3 rounded-pill bg-carbon py-2.5 pr-5 pl-2.5 text-sm font-bold text-paper fade-in slide-in-from-bottom-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-pill border border-paper bg-ember text-carbon">
              <Icon name="x" className="size-4" />
            </span>
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
