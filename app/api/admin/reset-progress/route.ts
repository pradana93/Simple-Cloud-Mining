import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdminApi } from "@/lib/api-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { firstRow } from "@/lib/ledger";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TAGS = ["site-settings", "plans", "faqs", "contents", "payouts", "site-stats"];

async function preview() {
  const admin = createAdminSupabase();
  const [members, rigs, invoices, deposits, withdrawals, games, chats, balances] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", false),
    admin.from("user_plan_history").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("transactions_history").select("id", { count: "exact", head: true }),
    admin.from("user_deposits").select("id", { count: "exact", head: true }),
    admin.from("user_withdrawal").select("id", { count: "exact", head: true }),
    admin.from("game_rounds").select("id", { count: "exact", head: true }),
    admin.from("chat_messages").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("balance").eq("is_admin", false),
  ]);

  const balance = ((balances as { data: unknown }).data ?? []) as Array<{ balance: number }>;
  return {
    members: (members as { count: number | null }).count ?? 0,
    activeRigs: (rigs as { count: number | null }).count ?? 0,
    invoices: (invoices as { count: number | null }).count ?? 0,
    deposits: (deposits as { count: number | null }).count ?? 0,
    withdrawals: (withdrawals as { count: number | null }).count ?? 0,
    games: (games as { count: number | null }).count ?? 0,
    chatMessages: (chats as { count: number | null }).count ?? 0,
    balance: balance.reduce((sum, row) => sum + Number(row.balance ?? 0), 0),
  };
}

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  try {
    return NextResponse.json({ ok: true, counts: await preview() });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read reset preview" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let confirm = "";
  try {
    confirm = String(((await req.json()) as { confirm?: unknown }).confirm ?? "");
  } catch {
    confirm = "";
  }
  if (confirm.trim() !== "RESET") {
    return NextResponse.json({ ok: false, error: "Type RESET exactly to confirm." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc("reset_app_progress");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const row = firstRow<{
      members_removed?: number;
      invoices_removed?: number;
      deposits_removed?: number;
      withdrawals_removed?: number;
      games_removed?: number;
    }>(data);
    for (const tag of TAGS) revalidateTag(tag);
    await recordAudit({
      actor: { id: gate.userId, name: gate.name },
      action: "progress.reset",
      detail: { ...row, confirm: "RESET" },
      req,
    });
    return NextResponse.json({
      ok: true,
      message: `Reset complete. Removed ${Number(row?.members_removed ?? 0)} members.`,
      removed: row,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
