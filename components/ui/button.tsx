import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        gold: "bg-gold-500 text-ink-950 hover:bg-gold-400",
        secondary: "panel text-slate-100 hover:border-gold-500/40 hover:text-white",
        outline: "border border-slate-700 bg-transparent text-slate-200 hover:border-gold-500/60 hover:text-white",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        sm: "h-11 px-4 text-xs",
        default: "h-11 px-5",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
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
