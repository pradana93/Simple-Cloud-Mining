import { ShieldCheck } from "lucide-react";
import { formatCrypto } from "@/lib/utils";
import type { CasinoEcon } from "@/lib/games/econ";
import type { GameMeta } from "@/lib/games/registry";

export function GameRules({
  meta,
  econ,
  code,
  decimals,
}: {
  meta: GameMeta;
  econ: CasinoEcon;
  code: string;
  decimals: number;
}) {
  const effective = meta.baseRtp * (1 - econ.edgeBoost / 100);
  const approx = Boolean(meta.rtpNote);

  return (
    <section className="panel rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck size={16} className="text-gold-400" /> Payout rules
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-400">Base return</dt>
          <dd className="font-mono mt-1 tabular-nums text-white">
            {approx ? "≈" : ""}
            {meta.baseRtp.toFixed(1)}%
          </dd>
          {meta.rtpNote && <p className="mt-1 text-[11px] text-slate-400">{meta.rtpNote}</p>}
        </div>
        <div>
          <dt className="text-xs text-slate-400">Site edge</dt>
          <dd className="font-mono mt-1 tabular-nums text-white">+{econ.edgeBoost.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Effective return</dt>
          <dd className="font-mono mt-1 tabular-nums text-gold-300">
            {approx ? "≈" : ""}
            {effective.toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Max win</dt>
          <dd className="font-mono mt-1 tabular-nums text-white">
            {econ.maxWin > 0 ? `${formatCrypto(econ.maxWin, decimals)} ${code}` : "No cap"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Bet range: {econ.minBet > 0 ? `${formatCrypto(econ.minBet, decimals)}` : "no minimum"} to{" "}
        {econ.maxBet > 0 ? `${formatCrypto(econ.maxBet, decimals)} ${code}` : "no maximum"}. The
        effective return already includes the site edge. A win above the cap is paid at the cap.
      </p>
    </section>
  );
}
