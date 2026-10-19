"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "scm_theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function apply(next: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
    document.cookie = `${KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={next === "light" ? "Switch to light theme" : "Switch to dark theme"}
      title={next === "light" ? "Light theme" : "Dark theme"}
      className={cn(
        "tap grid h-9 w-9 place-items-center rounded-xl text-slate-300 hover:bg-white/5 hover:text-white",
        className
      )}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
