"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Check, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; message: string };

const ToastCtx = createContext<{ push: (message: string, kind?: Kind) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const styles: Record<Kind, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  info: "border-slate-700 bg-ink-800 text-slate-200",
};

const icons: Record<Kind, React.ReactNode> = {
  success: <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />,
  error: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />,
  info: <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v, { id, kind, message }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), 3400);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2",
              styles[t.kind]
            )}
          >
            {icons[t.kind]}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setItems((v) => v.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              className="rounded-md p-0.5 text-slate-400 transition-colors hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
