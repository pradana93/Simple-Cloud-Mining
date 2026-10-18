import Link from "next/link";
import { Link2, Users } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { formatCrypto, timeAgo } from "@/lib/utils";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-medium text-slate-100">{v}</dd>
    </div>
  );
}

export function AffiliatePanel({
  count,
  earns,
  paid,
  commissionPct,
  decimals,
  code,
  referralLink,
  invites,
}: {
  count: number;
  earns: number;
  paid: number;
  commissionPct: number;
  decimals: number;
  code: string;
  referralLink: string;
  invites: Array<{ username: string | null; created_at: string }>;
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

      <dl className="mt-4 divide-y divide-white/5">
        <Row k="Invited" v={<span className="font-mono tabular-nums">{count}</span>} />
        <Row
          k="Earned"
          v={
            <span className="font-mono tabular-nums text-emerald-300">
              {formatCrypto(earns, decimals)} <span className="text-[11px] text-slate-400">{code}</span>
            </span>
          }
        />
        <Row
          k="Paid out"
          v={
            <span className="font-mono tabular-nums text-slate-200">
              {formatCrypto(paid, decimals)} <span className="text-[11px] text-slate-400">{code}</span>
            </span>
          }
        />
      </dl>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Link2 size={11} /> Your referral link
        </p>
        <div className="mt-2 flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-ink-950/70 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-200">
            {referralLink}
          </code>
          <CopyButton text={referralLink} label="Copy" />
        </div>
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Users size={11} /> Latest invites
        </p>
        {invites.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No invites yet. Share your link to get started.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {invites.slice(0, 5).map((iv, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-200">{iv.username ?? "member"}</span>
                <span className="shrink-0 text-slate-500">{timeAgo(iv.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
