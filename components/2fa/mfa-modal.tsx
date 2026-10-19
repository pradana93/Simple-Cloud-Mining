"use client";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { useToast } from "@/components/ui/toast";

export function MfaModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = code.length >= 6;

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        setCode("");
        onDone();
      } else {
        push(j.error ?? "That code is not valid.", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Confirm it is you"
      description="Payouts and wallet changes need a fresh code from your authenticator."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={verify} disabled={busy || !ready}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Checking
              </>
            ) : (
              <>
                <ShieldCheck size={15} /> Confirm
              </>
            )}
          </Button>
        </>
      }
    >
      <div>
        <Label htmlFor="mfa-code">Authenticator code</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="font-mono tracking-[0.4em]"
        />
        <p className="mt-2 text-xs text-slate-400">No device on hand? Enter a recovery code instead.</p>
      </div>
    </Modal>
  );
}
