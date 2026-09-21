"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function PurchaseButton({ planId }: { planId: number }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function buy() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const j = await res.json();
    setLoading(false);
    if (!j.ok) {
      setErr(j.error ?? "Purchase failed");
      return;
    }
    if (j.redirectUrl) window.location.href = j.redirectUrl as string;
    else if (j.hash) router.push(`/invoice/${j.hash}`);
  }
  return (
    <div>
      <Button onClick={buy} disabled={loading} className="w-full">{loading ? "Creating invoice…" : "Confirm purchase"}</Button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
