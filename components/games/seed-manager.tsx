"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { SeedView } from "./types";

// The fairness panel. The server commits to a hidden seed by publishing its
// hash; the member picks the client seed. Rotating the server seed reveals the
// old one so any past round can be re-checked.

export function SeedManager({ seed, onSeed }: { seed: SeedView | null; onSeed: (s: SeedView) => void }) {
  const { push } = useToast();
  const [client, setClient] = useState("client");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (seed) setClient(seed.clientSeed);
  }, [seed]);

  async function send(action: "set-client" | "rotate") {
    setBusy(true);
    try {
      const res = await fetch("/api/games/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, clientSeed: client }),
      });
      const j = (await res.json()) as { ok: boolean; seed?: SeedView; error?: string };
      if (!j.ok || !j.seed) {
        push(j.error || "Could not update the seed", "error");
        return;
      }
      onSeed(j.seed);
      push(
        action === "rotate"
          ? "Seed rotated. The previous server seed is now revealed."
          : "Client seed saved.",
        "success"
      );
    } catch {
      push("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="inline-flex items-center gap-2 font-display text-sm font-bold text-white">
          <ShieldCheck size={16} className="text-emerald-400" /> Provably fair
        </span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show seeds"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/5 px-5 py-4">
          <div>
            <Label>Server seed hash</Label>
            <p className="break-all rounded-xl bg-ink-900/80 px-3 py-2 font-mono text-xs text-slate-300 ring-1 ring-white/5">
              {seed?.serverSeedHash ?? "loading"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Every result is produced from the hidden server seed, your client seed and the bet nonce.
            </p>
          </div>
          <div>
            <Label htmlFor="client-seed">Client seed</Label>
            <div className="flex gap-2">
              <Input
                id="client-seed"
                value={client}
                maxLength={64}
                onChange={(e) => setClient(e.target.value)}
                className="font-mono text-xs"
              />
              <Button variant="secondary" disabled={busy || client === seed?.clientSeed} onClick={() => send("set-client")}>
                Save
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Nonce {seed?.nonce ?? 0}</span>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => send("rotate")}>
              <RefreshCw size={14} /> Rotate seed
            </Button>
          </div>
          {seed?.previous && (
            <div className="rounded-xl bg-ink-900/60 px-3 py-2 ring-1 ring-white/5">
              <p className="text-xs font-semibold text-slate-300">Revealed previous server seed</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">{seed.previous.serverSeed}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
