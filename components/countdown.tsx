"use client";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0"));
}

export function Countdown({ deadlineISO }: { deadlineISO: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = new Date(deadlineISO).getTime() - now;
  if (left <= 0) return <span className="font-semibold text-red-300">Expired</span>;
  const [h, m, s] = parts(left);
  return (
    <span className="font-mono font-bold tabular-nums text-gold-300">
      {h}:{m}:{s}
    </span>
  );
}
