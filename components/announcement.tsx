"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";

const KEY = "scm_announce_seen";

export function AnnouncementBanner({ text, link }: { text: string; link?: string | null }) {
  const id = `v1:${text}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let seen = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      seen = null;
    }
    setHidden(seen === id);
  }, [id]);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // storage blocked; the banner simply returns next load
    }
    setHidden(true);
  }

  return (
    <div className="border-b border-gold-500/20 bg-gold-500/10">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Megaphone size={15} className="shrink-0 text-gold-300" aria-hidden />
        {link ? (
          <Link href={link} className="min-w-0 flex-1 truncate text-sm font-medium text-gold-200 hover:text-gold-100 hover:underline">
            {text}
          </Link>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-medium text-gold-200">{text}</span>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gold-200 hover:bg-gold-500/15"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
