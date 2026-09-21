import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display text-sm font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        gold: "bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-[0_8px_30px_-8px_rgba(245,179,1,0.6)] hover:shadow-[0_8px_40px_-6px_rgba(245,179,1,0.8)] hover:brightness-110",
        secondary: "glass text-slate-100 hover:border-gold-500/40 hover:text-white",
        outline: "border border-slate-700 bg-transparent text-slate-200 hover:border-gold-500/60 hover:text-white",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
        destructive: "bg-gradient-to-b from-red-500 to-red-700 text-white hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5 text-xs",
        default: "h-11 px-5",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "gold", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
