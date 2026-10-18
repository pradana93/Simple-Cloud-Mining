import Link from "next/link";
import { Link2, Users } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { formatCrypto } from "@/lib/utils";

export function AffiliatePanel({
  count,
  earns,
  paid,
  commissionPct,
  decimals,
  code,
  referralLink,
}: {
  count: number;
  earns: number;
  paid: number;
  commissionPct: number;
  decimals: number;
  code: string;
  referralLink: string;
}) {
  return (
    <div className="panel flex flex-col rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-white">Affiliate</h2>
        <Link href="/affiliate" className="text-xs font-semibold text-gold-300 hover:text-gold-400">
          Details
        </Link>
      </div>
      <p className="mt-1 text-xs text-slate-400">Earn {commissionPct}% for life on every upgrade you refer.</p>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <Users size={11} /> Invited
          </p>
          <p className="font-mono mt-1 text-lg font-medium tabular-nums text-white">{count}</p>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-[11px] text-slate-400">Earned</p>
          <p className="font-mono mt-1 text-lg font-medium tabular-nums text-emerald-300">
            {formatCrypto(earns, decimals)}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-[11px] text-slate-400">Paid</p>
          <p className="font-mono mt-1 text-lg font-medium tabular-nums text-slate-200">
            {formatCrypto(paid, decimals)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Link2 size={11} /> Your referral link
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-ink-950/70 px-3 py-2.5 font-mono text-xs text-slate-200">
            {referralLink}
          </code>
          <CopyButton text={referralLink} label="Copy" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Amounts shown in {code}.</p>
      </div>
    </div>
  );
}
