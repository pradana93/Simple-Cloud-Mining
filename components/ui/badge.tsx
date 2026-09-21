import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        gold: "bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/40",
        green: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
        slate: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/40",
        red: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
        blue: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40",
      },
    },
    defaultVariants: { variant: "slate" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
