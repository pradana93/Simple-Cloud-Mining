"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
      <div
        className={cn(
          "animate-scale-in relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
