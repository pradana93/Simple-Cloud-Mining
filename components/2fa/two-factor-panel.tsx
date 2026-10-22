"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "@/components/copy-button";

type Stage = "off" | "scan" | "recovery";

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [stage, setStage] = useState<Stage>(enabled ? "off" : "off");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/setup", { method: "POST" });
      const j = (await res.json()) as { ok: boolean; secret?: string; uri?: string; error?: string };
      if (j.ok && j.secret && j.uri) {
        setSecret(j.secret);
        setUri(j.uri);
        setCode("");
        setStage("scan");
      } else {
        push(j.error ?? "Could not start setup", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = (await res.json()) as { ok: boolean; recoveryCodes?: string[]; error?: string };
      if (j.ok && j.recoveryCodes) {
        setRecovery(j.recoveryCodes);
        setStage("recovery");
        router.refresh();
      } else {
        push(j.error ?? "That code did not match", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function forgetDevices() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/trusted-devices", { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      push(j.ok ? "Trusted devices forgotten" : j.error ?? "Could not forget devices", j.ok ? "success" : "error");
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        push("Two-factor turned off", "success");
        setCode("");
        setStage("off");
        router.refresh();
      } else {
        push(j.error ?? "That code is not valid", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
          {enabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-white">Two-factor sign-in</h2>
          <p className="text-xs text-slate-400">
            {enabled
              ? "On. Trusted devices skip the code for 30 days; payouts still ask."
              : "Off. Add an authenticator app for a second step at sign-in."}
          </p>
        </div>
      </div>

      {stage === "recovery" ? (
        <div className="mt-5">
          <p className="text-sm text-slate-200">
            Two-factor is on. Save these recovery codes somewhere safe. Each works once if you lose your device.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recovery.map((c) => (
              <li key={c} className="rounded-lg bg-white/5 px-3 py-2 text-center font-mono text-xs text-slate-200">
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyButton text={recovery.join("\n")} />
            <Button variant="secondary" onClick={() => setStage("off")}>
              <Check size={15} /> I saved them
            </Button>
          </div>
        </div>
      ) : stage === "scan" ? (
        <div className="mt-5 space-y-4">
          <ol className="space-y-2 text-sm text-slate-300">
            <li>1. Open your authenticator app and add an account by key.</li>
            <li>2. Name it anything, then paste this key:</li>
          </ol>
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="min-w-0 break-all font-mono text-xs text-slate-100">{secret}</span>
            <CopyButton text={secret} />
          </div>
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer select-none">Advanced: add by setup link</summary>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="min-w-0 break-all font-mono text-[11px] text-slate-300">{uri}</span>
              <CopyButton text={uri} />
            </div>
          </details>
          <div>
            <Label htmlFor="totp-code">Enter the 6-digit code from the app</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="font-mono tracking-[0.4em]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={confirm} disabled={busy || code.length < 6}>
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Checking
                </>
              ) : (
                <>
                  <ShieldCheck size={15} /> Turn on
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={() => setStage("off")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : enabled ? (
        <div className="mt-5 space-y-3">
          <div>
            <Label htmlFor="disable-code">Code to turn it off</Label>
            <Input
              id="disable-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="font-mono tracking-[0.4em]"
            />
          </div>
          <Button variant="secondary" onClick={disable} disabled={busy || code.length < 6}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Checking
              </>
            ) : (
              "Turn off two-factor"
            )}
          </Button>
          <div className="border-t border-white/10 pt-3">
            <Button variant="secondary" onClick={forgetDevices} disabled={busy}>
              Forget trusted devices
            </Button>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Use this on a shared browser. All remembered devices will need a code again.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button onClick={start} disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Preparing
              </>
            ) : (
              <>
                <ShieldCheck size={15} /> Set up two-factor
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
