"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/components/ui/toast";

export function PurchaseButton({ planId }: { planId: number }) {
  const router = useRouter();
  const { push } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Purchase failed");
        push(j.error ?? "Purchase failed", "error");
        return;
      }
      push("Invoice created", "success");
      if (j.redirectUrl) window.location.href = j.redirectUrl as string;
      else if (j.hash) router.push(`/invoice/${j.hash}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      setErr(msg);
      push(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={buy} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Creating invoice
          </>
        ) : (
          "Confirm purchase"
        )}
      </Button>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}
