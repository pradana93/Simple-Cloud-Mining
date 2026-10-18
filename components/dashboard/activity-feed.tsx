import { ArrowDownToLine, Percent, Pickaxe, Users, WalletMinimal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCrypto, timeAgo } from "@/lib/utils";

export type ActivityKind = "deposit" | "withdrawal" | "affiliate" | "referral" | "plan";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  label: string;
  amount: number | null;
  at: string | null;
  status?: string | null;
};

const ICON = {
  deposit: <ArrowDownToLine size={15} />,
  withdrawal: <WalletMinimal size={15} />,
  affiliate: <Percent size={15} />,
  referral: <Users size={15} />,
  plan: <Pickaxe size={15} />,
};

const TONE: Record<ActivityKind, string> = {
  deposit: "bg-emerald-500/15 text-emerald-300",
  withdrawal: "bg-gold-500/15 text-gold-300",
  affiliate: "bg-emerald-500/15 text-emerald-300",
  referral: "bg-slate-500/15 text-slate-300",
  plan: "bg-gold-500/15 text-gold-300",
};

function variant(status: string): "green" | "gold" | "red" | "slate" {
  const v = status.toLowerCase();
  if (["paid", "success", "replied"].includes(v)) return "green";
  if (["pending", "waiting", "processing", "unread"].includes(v)) return "gold";
  if (["canceled", "cancelled", "failed"].includes(v)) return "red";
  return "slate";
}

export function ActivityFeed({
  items,
  decimals,
  code,
}: {
  items: ActivityItem[];
  decimals: number;
  code: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-slate-400">Nothing has happened yet. Your deposits, rigs and payouts will appear here.</p>;
  }
  return (
    <ol className="divide-y divide-white/5">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 py-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[it.kind]}`}>{ICON[it.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{it.label}</p>
            <p className="text-[11px] text-slate-400">{timeAgo(it.at)}</p>
          </div>
          {it.amount != null && (
            <span className="font-mono shrink-0 text-sm tabular-nums text-white">
              {formatCrypto(it.amount, decimals)} <span className="text-[11px] text-slate-400">{code}</span>
            </span>
          )}
          {it.status && (
            <Badge variant={variant(it.status)} className="shrink-0">
              {it.status}
            </Badge>
          )}
        </li>
      ))}
    </ol>
  );
}
