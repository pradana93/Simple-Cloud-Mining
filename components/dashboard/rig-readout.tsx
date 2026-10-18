import { Pickaxe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrypto, formatDuration } from "@/lib/utils";

export type RigView = {
  id: number;
  name: string;
  version: string | null;
  rate: number;
  price: number;
  earned: number;
  roiPct: number | null;
  expiryPct: number | null;
  daysLeft: number | null;
  breakEvenMinutes: number | null;
  startedAt: string;
  decimals: number;
  code: string;
};

function Bar({ pct, tone }: { pct: number; tone: "gold" | "emerald" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "emerald" ? "bg-emerald-400" : "bg-gradient-to-r from-gold-500 to-gold-300"
        )}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function RigReadout({ rig, symbol }: { rig: RigView; symbol: string }) {
  const paidBack = rig.roiPct != null && rig.roiPct >= 100;
  return (
    <div className="panel card-hover rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <Pickaxe size={20} />
          </span>
          <div>
            <p className="font-display font-bold text-white">
              {rig.name} {rig.version ?? ""}
            </p>
            <p className="text-xs text-slate-400">Started {new Date(rig.startedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <Badge variant="green">Hashing</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="border-t-2 border-gold-500/50 pt-2.5">
          <p className="text-[11px] text-slate-400">Rate / min</p>
          <p className="font-mono mt-1 text-base font-medium tabular-nums text-white">
            {formatCrypto(rig.rate, 8)}
          </p>
        </div>
        <div className="border-t-2 border-gold-500/50 pt-2.5">
          <p className="text-[11px] text-slate-400">Earned</p>
          <p className="font-mono mt-1 text-base font-medium tabular-nums text-emerald-300">
            {formatCrypto(rig.earned, rig.decimals)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              {rig.price > 0 ? <>Return on {symbol}{formatCrypto(rig.price, rig.decimals)}</> : "Free rig"}
            </span>
            <span className={cn("font-medium", paidBack ? "text-emerald-300" : "text-slate-300")}>
              {rig.roiPct == null
                ? "no cost"
                : paidBack
                  ? `${Math.round(rig.roiPct)}% paid back`
                  : `${rig.roiPct.toFixed(1)}%`}
            </span>
          </div>
          {rig.roiPct != null && <Bar pct={rig.roiPct} tone={paidBack ? "emerald" : "gold"} />}
          {rig.price > 0 && !paidBack && rig.breakEvenMinutes != null && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Break-even in {formatDuration(rig.breakEvenMinutes)}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Contract</span>
            <span className="font-medium text-slate-300">
              {rig.daysLeft == null ? "open ended" : `${Math.ceil(rig.daysLeft)}d left`}
            </span>
          </div>
          {rig.expiryPct != null && <Bar pct={rig.expiryPct} tone="gold" />}
        </div>
      </div>
    </div>
  );
}
