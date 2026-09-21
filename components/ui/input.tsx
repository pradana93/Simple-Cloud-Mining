import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400", className)} {...props} />;
}
